import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
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
        window.location.href = "/fr/login";
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
  me: () => api.get("/b2b/auth/me"),
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
  updateStatus: (id: number, status: string) => 
    api.put(`/b2b/requests/${id}/status`, { status }),
};

// --- Notifications ---
export const b2bNotifications = {
  getAll: () => api.get("/b2b/notifications"),
  markRead: (id: number) => api.patch(`/b2b/notifications/${id}/read`),
  markAllRead: () => api.patch("/b2b/notifications/read-all"),
};
