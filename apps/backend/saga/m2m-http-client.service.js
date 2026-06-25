/**
 * M2MHttpClient
 *
 * Client HTTP sécurisé pour la communication Machine-to-Machine
 * avec l'Authoring Engine (Moodle).
 *
 * Sécurité :
 * - Signature HMAC-SHA256 avec secret partagé
 * - Anti-replay via timestamp (validation < 60s côté serveur)
 * - x-correlation-id pour le tracing distribué
 * - Timeout configurable
 */
import axios from 'axios';
import crypto from 'crypto';

export class M2MHttpClient {
  constructor() {
    this.baseUrl = process.env.AUTHORING_ENGINE_URL || 'http://localhost:4001';
    this.secret = process.env.SAGA_API_KEY;
    this.timeout = parseInt(process.env.M2M_HTTP_TIMEOUT || '15000', 10);
  }

  /**
   * Calcule la signature HMAC-SHA256 pour l'en-tête x-saga-key
   * @param {string} timestamp - ISO 8601
   * @returns {string} Signature hexadécimale
   */
  computeSignature(timestamp) {
    const data = `${timestamp}:${this.secret}`;
    return crypto
      .createHmac('sha256', this.secret)
      .update(data, 'utf-8')
      .digest('hex');
  }

  /**
   * Appelle un endpoint de l'Authoring Engine avec signature M2M
   * @param {string} method - Méthode HTTP (POST, GET, etc.)
   * @param {string} path - Chemin de l'API (ex: /api/v1/authoring/enrollments)
   * @param {Object} body - Corps de la requête
   * @param {string} correlationId - ID de corrélation pour le tracing
   * @returns {Promise<Object>} Réponse de l'API
   */
  async request(method, path, body, correlationId) {
    if (!this.secret) {
      throw new Error('M2MHttpClient: SAGA_API_KEY is not configured');
    }

    const timestamp = new Date().toISOString();
    const signature = this.computeSignature(timestamp);
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await axios({
        method: method.toLowerCase(),
        url,
        data: body,
        headers: {
          'x-saga-key': signature,
          'x-timestamp': timestamp,
          'x-correlation-id': correlationId,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
        validateStatus: null, // On gère tous les codes HTTP nous-mêmes
      });

      const { status, data } = response;

      return {
        status,
        success: status >= 200 && status < 300,
        data: data || {},
        correlationId,
      };
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND') {
        return {
          status: 503,
          success: false,
          data: { code: 'MOODLE_UNREACHABLE', message: err.message },
          correlationId,
        };
      }

      return {
        status: 500,
        success: false,
        data: { code: 'M2M_ERROR', message: err.message },
        correlationId,
      };
    }
  }

  /**
   * Raccourci pour POST
   */
  async post(path, body, correlationId) {
    return this.request('POST', path, body, correlationId);
  }
}