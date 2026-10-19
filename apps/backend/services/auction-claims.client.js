/**
 * Client interne vers le service des enchères (ADR-0021, D4) — clé `x-internal-key`.
 *   GET  {AUCTIONS_INTERNAL_URL}/claims/:auctionId?token=…   invitation (montant, devise, personne, échéance)
 *   POST {AUCTIONS_INTERNAL_URL}/claims/:auctionId/paid        { rank, reference, amount, currency } (idempotent)
 * Les erreurs réseau sont normalisées en 503 (réessayable).
 */
import axios from "axios";

export class AuctionClaimsClient {
    constructor(env = process.env) {
        this.baseUrl = (env.AUCTIONS_INTERNAL_URL || "http://localhost:4002/api/internal").replace(/\/+$/, "");
        this.apiKey = env.INTERNAL_API_KEY;
        this.timeout = 8000;
    }

    isConfigured() { return Boolean(this.baseUrl && this.apiKey); }

    async request(method, path, data) {
        try {
            const res = await axios({ method, url: `${this.baseUrl}${path}`, data, timeout: this.timeout, validateStatus: null, headers: { "x-internal-key": this.apiKey, "Content-Type": "application/json" } });
            return { status: res.status, data: res.data || {} };
        } catch (err) {
            return { status: 503, data: { code: "AUCTIONS_UNREACHABLE", message: err.message } };
        }
    }

    check(auctionId, token) { return this.request("get", `/claims/${encodeURIComponent(auctionId)}?token=${encodeURIComponent(token)}`); }

    markPaid(auctionId, body) { return this.request("post", `/claims/${encodeURIComponent(auctionId)}/paid`, body); }
}

export default AuctionClaimsClient;
