import axios from "axios";

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

  // If we're on the server, we need to inject the key for direct calls
  if (typeof window === "undefined") {
    const apiKey = process.env.ADMIN_API_KEY;
    if (apiKey) {
      config.headers["x-api-key"] = apiKey;
    }
  }

  return config;
});

// Response interceptor — normalize errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      "Unexpected server error";

    const status = error.response?.status;

    if (status === 401) {
      console.error("[PSP API] Unauthorized — check admin API key");
    }

    if (status === 403) {
      console.error("[PSP API] Forbidden — key lacks admin privileges");
    }

    return Promise.reject(new Error(`[${status || "NET"}] ${message}`));
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

  // Test API (Formations + Orders)
  getTestFormations: () => api.get("/test/formations"),
  getTestFormation: (id: string) => api.get(`/test/formations/${id}`),
  createTestOrder: (data: {
    formationId: string;
    formationName?: string;
    formationPrice?: number;
    customerEmail: string;
    customerName: string;
    customerSurname?: string;
    customerPhone?: string;
    customerCity?: string;
    purchaseType?: string;
    amount?: number;
    beneficiaryEmail?: string;
    beneficiaryFirstName?: string;
    beneficiaryLastName?: string;
  }) => api.post("/test/orders", data),
  simulateTestPayment: (id: number, status?: string) =>
    api.post(`/test/orders/${id}/simulate-payment`, { status }),
  deleteTestOrder: (id: number) => api.delete(`/test/orders/${id}`),
  simulateWebhook: (data: { orderId: number; provider: string; status: string }) =>
    api.post("/test/simulate-webhook", data),
  resetOrder: (id: number) => api.post(`/test/orders/${id}/reset`),

  // Test API (B2B Packages)
  getTestPackages: () => api.get("/test/packages"),
  createTestB2BOrder: (data: {
    packageId?: string;
    packageName?: string;
    packagePrice?: number;
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
    customerCountry?: string;
    amount?: number;
    companyName?: string;
    companyIndustry?: string;
    companyAdminEmail?: string;
    licenceCount?: number;
    unitPrice?: number;
  }) => api.post("/test/b2b-orders", data),
  simulateB2BPayment: (id: number, status?: string) =>
    api.post(`/test/b2b-orders/${id}/simulate-payment`, { status }),
  provisionB2BOrder: (id: number) =>
    api.post(`/test/b2b-orders/${id}/provision`),

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
