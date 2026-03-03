/**
 * Provider Health Check Service
 * 
 * Vérifie la disponibilité des providers de paiement widget-based (comme Kkiapay)
 * avant de les proposer aux utilisateurs.
 * 
 * Les providers redirect (CinetPay, Stripe) ne nécessitent pas de health check
 * car le paiement se fait sur leur serveur.
 */

// Providers qui utilisent un widget frontend (nécessitent health check)
const WIDGET_PROVIDERS = ['kkiapay'];

// Configuration des endpoints à vérifier
const HEALTH_CHECK_CONFIG = {
  kkiapay: {
    endpoints: [
      { url: 'https://cdn.kkiapay.me/k.js', name: 'CDN' },
      { url: 'https://widget-v3.kkiapay.me', name: 'Widget' }
    ],
    timeout: 10000,  // 10 secondes max (augmenté pour les connexions lentes)
    cacheTTL: 5 * 60 * 1000  // 5 minutes
  }
};

class ProviderHealthService {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Vérifie si un provider nécessite un health check
   * Only widget-based providers need health checks
   * @param {string} providerCode - Code du provider (ex: 'kkiapay', 'cinetpay', 'stripe')
   * @returns {boolean}
   */
  needsHealthCheck(providerCode) {
    return WIDGET_PROVIDERS.includes(providerCode?.toLowerCase());
  }

  /**
   * Vérifie la disponibilité d'un provider
   * @param {string} providerCode - Code du provider
   * @returns {Promise<{available: boolean, checkedAt: Date, error?: string}>}
   */
  async checkProviderHealth(providerCode) {
    const code = providerCode?.toLowerCase();

    // Si pas un provider widget, considéré comme disponible
    if (!this.needsHealthCheck(code)) {
      return { 
        available: true, 
        checkedAt: new Date(),
        reason: 'Redirect provider, no health check needed'
      };
    }

    const config = HEALTH_CHECK_CONFIG[code];
    if (!config) {
      console.warn(`[ProviderHealth] No health check config for provider: ${code}`);
      return { 
        available: true, 
        checkedAt: new Date(),
        reason: 'No health check configured for this provider'
      };
    }

    // Vérifier le cache
    const cached = this.cache.get(code);
    if (cached && Date.now() - cached.timestamp < config.cacheTTL) {
      console.log(`[ProviderHealth] Using cached result for ${code}: ${cached.result.available}`);
      return cached.result;
    }

    // Faire le health check HTTP
    console.log(`[ProviderHealth] Checking health for ${code}...`);
    
    // Utiliser fetch natif ou node-fetch
    const fetchFn = global.fetch || (() => {
      try { return require('node-fetch'); } catch(e) { return null; }
    })();
    
    if (!fetchFn) {
      console.warn('[ProviderHealth] No fetch available, assuming provider is available');
      return { available: true, checkedAt: new Date(), reason: 'No fetch available' };
    }
    
    const results = await Promise.allSettled(
      config.endpoints.map(async (endpoint) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeout);
        
        try {
          const startTime = Date.now();
          const response = await fetchFn(endpoint.url, { 
            method: 'HEAD',
            signal: controller.signal 
          });
          const latency = Date.now() - startTime;
          
          return {
            name: endpoint.name,
            url: endpoint.url,
            ok: response.ok,
            status: response.status,
            latency
          };
        } catch (error) {
          return {
            name: endpoint.name,
            url: endpoint.url,
            ok: false,
            error: error.message
          };
        } finally {
          clearTimeout(timeout);
        }
      })
    );

    // Analyser les résultats
    const details = results.map(r => r.status === 'fulfilled' ? r.value : { ok: false, error: r.reason });
    const allOk = details.every(d => d.ok);
    
    const result = {
      available: allOk,
      checkedAt: new Date(),
      details: details,
      error: allOk ? undefined : details.filter(d => !d.ok).map(d => d.error || `Failed: ${d.name}`).join(', ')
    };

    // Mettre en cache
    this.cache.set(code, {
      result,
      timestamp: Date.now()
    });

    console.log(`[ProviderHealth] ${code} health check: ${result.available ? 'AVAILABLE' : 'UNAVAILABLE'}`, 
      result.details?.map(d => `${d.name}: ${d.ok ? 'OK' : 'FAIL'}`).join(', '));

    return result;
  }

  /**
   * Force le refresh du cache pour un provider
   * @param {string} providerCode 
   */
  invalidateCache(providerCode) {
    const code = providerCode?.toLowerCase();
    if (this.cache.has(code)) {
      this.cache.delete(code);
      console.log(`[ProviderHealth] Cache invalidated for ${code}`);
    }
  }

  /**
   * Force le refresh du cache pour tous les providers
   */
  invalidateAllCache() {
    this.cache.clear();
    console.log('[ProviderHealth] All cache invalidated');
  }

  /**
   * Retourne le statut du cache pour un provider
   * @param {string} providerCode 
   * @returns {object|null}
   */
  getCacheStatus(providerCode) {
    const code = providerCode?.toLowerCase();
    const cached = this.cache.get(code);
    if (!cached) return null;
    
    const config = HEALTH_CHECK_CONFIG[code];
    const age = Date.now() - cached.timestamp;
    const ttl = config?.cacheTTL || 0;
    
    return {
      cached: true,
      age: age,
      ttl: ttl,
      remainingTTL: Math.max(0, ttl - age),
      available: cached.result.available
    };
  }
}

// Export singleton instance
export default new ProviderHealthService();
