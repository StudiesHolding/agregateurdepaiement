import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
// Fixed: Ensure the URL always ends with /api if not provided in env
const FINAL_API_URL = API_BASE_URL.endsWith("/api") ? API_BASE_URL : `${API_BASE_URL}/api`;

export const api = axios.create({
  baseURL: FINAL_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Interceptor to add auth token
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("b2b_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("b2b_token");
        document.cookie = "b2b_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        const locale = window.location.pathname.split("/")[1] || "fr";
        window.location.href = `/${locale}/login`;
      }
    }
    return Promise.reject(error);
  }
);

// ==========================================
// B2B API Functions
// ==========================================

// --- Auth ---
export const b2bAuth = {
  login: (email: string, password: string) =>
    api.post("/b2b/auth/login", { email, password }),
  activate: (token: string, email: string, password: string) =>
    api.post("/b2b/auth/activate", { token, email, password }),
  me: () => api.get("/b2b/auth/me"),
  logout: () => {
    localStorage.removeItem("b2b_token");
    document.cookie = "b2b_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    return Promise.resolve();
  },
  updateProfile: (data: { first_name?: string; last_name?: string }) =>
    api.put("/b2b/auth/profile", data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.put("/b2b/auth/password", data),
};

// --- Dashboard Stats ---
export const b2bDashboard = {
  getStats: () => api.get("/b2b/dashboard/stats"),
};

// --- Packages ---
export const b2bPackages = {
  getAll: () => api.get("/b2b/packages"),
  getById: (id: number) => api.get(`/b2b/packages/${id}`),
  getCatalog: () => api.get("/b2b/packages/catalog"),
  purchase: (data: { package_id: number; total_licenses: number }) =>
    api.post("/b2b/packages/purchase", data),
  // NOUVEAU: Ajouter des licences à un package existant
  addLicenses: (packageId: number, data: { additional_licenses: number; paymentMethod?: string; countryCode?: string; currency?: string }) =>
    api.post(`/b2b/packages/${packageId}/add-licenses`, data),
};

// --- Employees ---
export const b2bEmployees = {
  getAll: () => api.get("/b2b/employees"),
  getById: (id: number) => api.get(`/b2b/employees/${id}`),
  create: (data: {
    first_name: string;
    last_name: string;
    email: string;
    department?: string;
    position?: string;
  }) => api.post("/b2b/employees", data),
  update: (id: number, data: Record<string, string>) =>
    api.put(`/b2b/employees/${id}`, data),
  delete: (id: number) => api.delete(`/b2b/employees/${id}`),
};

// --- Licenses ---
export const b2bLicenses = {
  assign: (data: { employee_id: number; company_package_id: number }) =>
    api.post("/b2b/licenses/assign", data),
  getAvailable: (companyPackageId: number) =>
    api.get(`/b2b/packages/${companyPackageId}/licenses/available`),
};

// --- Access Requests ---
export const b2bRequests = {
  getAll: () => api.get("/b2b/requests"),
  getById: (id: number) => api.get(`/b2b/requests/${id}`),
  // Note: approve/reject are admin-only actions handled in Admin Dashboard
};

// --- Notifications ---
export const b2bNotifications = {
  getAll: () => api.get("/b2b/notifications"),
  markRead: (id: number) => api.patch(`/b2b/notifications/${id}/read`),
  markAllRead: () => api.patch("/b2b/notifications/read-all"),
};

// --- Orders ---
export const b2bOrders = {
  getAll: () => api.get("/b2b/orders"),
  getById: (id: number) => api.get(`/b2b/orders/${id}`),
  getInvoice: (id: number) =>
    api.get(`/b2b/orders/${id}/invoice`, { responseType: 'blob' }),
  exportInvoice: (id: number) =>
    api.get(`/b2b/orders/${id}/export-invoice`, { responseType: 'blob' }),
  initiatePayment: (data: { package_id: number; total_licenses: number; paymentMethod?: string; countryCode?: string; currency?: string }) =>
    api.post("/b2b/orders/initiate-payment", data),
};

// --- PDF Export ---
export const b2bExport = {
  exportRequestsPDF: () => api.get("/b2b/requests/export-pdf", { responseType: 'blob' }),
};
