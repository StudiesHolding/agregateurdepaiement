import axios from "axios";
import { signOut } from "next-auth/react";

const API_URL = typeof window !== "undefined"
  ? "/api/psp"
  : (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000") + "/api";

/**
 * Axios instance for PSP Admin API calls
 * In the browser, we use the local proxy /api/psp which then prefixes with /admin.
 * On the server, we call the backend /api/admin directly.
 */
export const api = axios.create({
  baseURL: `${API_URL}/admin`,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request interceptor
api.interceptors.request.use((config) => {
  // Fix: Axios strips paths from baseURL if the URL starts with /
  // We remove the leading slash to ensure it's appended to the baseURL path.
  if (config.url?.startsWith("/")) {
    config.url = config.url.substring(1);
  }

  // Aucune clé injectée : le navigateur passe par le relais /api/psp, qui porte la session (ADR-0018, D5).

  return config;
});

// Response interceptor — normalize errors
let sessionClosing = false;

/** Message d'erreur lisible renvoyé par le PSP (sans préfixe technique). */
export class PspApiError extends Error {
  constructor(message: string, public status?: number, public code?: string) { super(message); }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status: number | undefined = error.response?.status;
    const data = error.response?.data ?? {};
    // Session expirée : retour à la connexion Studies Learning (le cookie chiffré n'est plus valable).
    // La session du tableau de bord est fermée aussi, sinon la page de connexion renverrait aussitôt à l'accueil.
    if (status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login") && !sessionClosing) {
      sessionClosing = true;
      void signOut({ callbackUrl: "/login?error=SESSION_EXPIRED" });
    }
    const message =
      data.message ||
      (status === 403 ? "Votre compte n’a pas la permission nécessaire pour cette action." : null) ||
      (status ? "Le service de paiement a rencontré une erreur. Réessayez." : "Le service de paiement ne répond pas. Vérifiez votre connexion.");
    return Promise.reject(new PspApiError(message, status, data.code));
  },
);

// ── Typed API helpers ─────────────────────────────────────────────────────────

export const adminApi = {
  // KPIs
  getOverviewKpis: () => api.get("/kpis/overview"),
  getTimeSeries: (period = "30d") =>
    api.get(`/kpis/timeseries?period=${period}`),
  getLmsAnalytics: (period = "30d", limit = 10) =>
    api.get(`/kpis/lms?period=${period}&limit=${limit}`),

  // Analytics
  getGeoBreakdown: (period = "30d") =>
    api.get(`/analytics/geo?period=${period}`),
  getProviderPerformance: (period = "24h") =>
    api.get(`/analytics/providers?period=${period}`),

  // Providers
  getProviders: (period = "24h") => api.get(`/providers?period=${period}`),
  getFactoryCodes: () => api.get("/providers/factory-codes"),
  getProviderSparkline: (id: number) => api.get(`/providers/${id}/sparkline`),
  getProviderErrors: (id: number, period = "24h") =>
    api.get(`/providers/${id}/errors?period=${period}`),
  createProvider: (data: Record<string, unknown>) =>
    api.post("/providers", data),
  updateProvider: (id: number, data: Record<string, unknown>) =>
    api.put(`/providers/${id}`, data),
  toggleProvider: (id: number) => api.put(`/providers/${id}/toggle`),
  testProvider: (id: number) => api.post(`/providers/${id}/test`),

  // Routes
  getRoutes: () => api.get("/routes"),
  getRouteMatrix: () => api.get("/routes/matrix"),
  simulateRoute: (payload: {
    countryCode: string;
    currency: string;
    amount: number;
    paymentMethod: string;
  }) => api.post("/routes/simulate", payload),
  createRoute: (data: Record<string, unknown>) => api.post("/routes", data),
  updateRoute: (id: number, data: Record<string, unknown>) =>
    api.put(`/routes/${id}`, data),
  deleteRoute: (id: number) => api.delete(`/routes/${id}`),

  // Transactions
  getTransactions: (params: Record<string, string | number>) =>
    api.get("/transactions", { params }),
  getTransaction: (txnNumber: string) => api.get(`/transactions/${txnNumber}`),

  // Webhooks
  getWebhooks: (params: Record<string, string | number>) =>
    api.get("/webhooks", { params }),
  replayWebhook: (id: number) => api.post(`/webhooks/${id}/replay`),

  // Audit
  getAuditLogs: (params: Record<string, string | number>) =>
    api.get("/audit-logs", { params }),

  // Notifications
  getNotifications: () => api.get("/notifications"),
  getMyNotifications: () => api.get("/notifications/me"),
  searchLmsAdmins: (q: string) => api.get(`/notifications/search?q=${q}`),
  updateNotificationSetting: (data: Record<string, unknown>) =>
    api.post("/notifications", data),
  deleteNotificationSetting: (id: number) => api.delete(`/notifications/${id}`),

  // Admin In-App Notifications
  getAdminNotifications: () => api.get("/admin-notifications"),
  markNotificationAsRead: (id: number) => api.put(`/admin-notifications/${id}/read`),
  clearAllNotifications: () => api.put("/admin-notifications/read-all"),

  // Orders (LMS Workflow)
  getOrders: (params: Record<string, string | number>) =>
    api.get("/orders", { params }),
  getOrder: (id: number) => api.get(`/orders/${id}`),
  validateOrder: (
    id: number,
    data: { action: "validate" | "reject"; notes?: string },
  ) => api.post(`/orders/${id}/validate`, data),
  completeOrder: (id: number, data: { username: string; password: string }) =>
    api.post(`/orders/${id}/complete`, data),
  getOrderAudit: (id: number, params: Record<string, number>) =>
    api.get(`/orders/${id}/audit`, { params }),
  getOrderProvisioning: (id: number) =>
    api.get(`/orders/${id}/provisioning`),

  // Access Requests (B2B)
  getRequests: (params?: Record<string, string | number>) =>
    api.get("/requests", { params }),
  getRequest: (id: number) => api.get(`/requests/${id}`),
  approveRequest: (id: number, data: { username: string; password: string; admin_notes?: string }) =>
    api.post(`/requests/${id}/approve`, data),
  batchApproveRequests: (data: { request_ids: number[]; credentials: { username: string; password: string }; admin_notes?: string }) =>
    api.post("/requests/batch-approve", data),
  rejectRequest: (id: number, data: { reason?: string; admin_notes?: string }) =>
    api.post(`/requests/${id}/reject`, data),
  batchRejectRequests: (data: { request_ids: number[]; reason?: string; admin_notes?: string }) =>
    api.post("/requests/batch-reject", data),
};
