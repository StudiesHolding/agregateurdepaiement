import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

/**
 * Axios instance for PSP Admin API calls
 * Injects x-api-key automatically on all requests
 */
export const api = axios.create({
    baseURL: `${API_BASE}/api/admin`,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 15000,
});

// Request interceptor — inject admin API key
api.interceptors.request.use((config) => {
    const apiKey =
        process.env.ADMIN_API_KEY ||
        (typeof window !== "undefined"
            ? localStorage.getItem("psp_admin_key")
            : null);

    if (apiKey) {
        config.headers["x-api-key"] = apiKey;
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
    }
);

// ── Typed API helpers ─────────────────────────────────────────────────────────

export const adminApi = {
    // KPIs
    getOverviewKpis: () => api.get("/kpis/overview"),
    getTimeSeries: (period = "30d") => api.get(`/kpis/timeseries?period=${period}`),
    getLmsAnalytics: (period = "30d", limit = 10) =>
        api.get(`/kpis/lms?period=${period}&limit=${limit}`),

    // Analytics
    getGeoBreakdown: (period = "30d") => api.get(`/analytics/geo?period=${period}`),
    getProviderPerformance: (period = "24h") =>
        api.get(`/analytics/providers?period=${period}`),

    // Providers
    getProviders: (period = "24h") => api.get(`/providers?period=${period}`),
    getFactoryCodes: () => api.get("/providers/factory-codes"),
    getProviderSparkline: (id: number) => api.get(`/providers/${id}/sparkline`),
    getProviderErrors: (id: number, period = "24h") =>
        api.get(`/providers/${id}/errors?period=${period}`),
    createProvider: (data: Record<string, unknown>) => api.post("/providers", data),
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
    searchLmsAdmins: (q: string) => api.get(`/notifications/search?q=${q}`),
    updateNotificationSetting: (data: Record<string, unknown>) => api.post("/notifications", data),
    deleteNotificationSetting: (id: number) => api.delete(`/notifications/${id}`),
};
