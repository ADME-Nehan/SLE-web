import axios from "axios";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_BASE,
  timeout: 8000,
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("sle_admin_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401 || status === 403) {
      const currentPath = window.location.pathname;

      if (currentPath.startsWith("/admin")) {
        localStorage.removeItem("sle_admin_token");
      }
    }

    return Promise.reject(error);
  }
);

// Auth
export const adminLogin = (data) => api.post("/auth/login", data);
export const getAdminMe = () => api.get("/auth/me");

// Dashboard
export const getDashboardStats = () => api.get("/dashboard/stats");

// News
export const getNews = (params = {}, config = {}) =>
  api.get("/news", {
    params,
    ...config
  });

export const getArticleById = (id) => api.get(`/news/${id}`);

export const getArticleAiSummary = (id) =>
  api.get(`/news/${id}/ai-summary`);

export const getCategories = () => api.get("/news/categories");

export const deleteArticle = (id) => api.delete(`/news/${id}`);

export const updateArticlePriority = (id, data) =>
  api.put(`/news/${id}/priority`, data);

// Sources
export const getSources = () => api.get("/sources");

export const addSource = (data) => api.post("/sources", data);

export const updateSource = (id, data) => api.put(`/sources/${id}`, data);

export const deleteSource = (id) => api.delete(`/sources/${id}`);

export const fetchOneSource = (id) => api.post(`/sources/${id}/fetch`);

export const runAllSources = () => api.post("/sources/run/all");

export function getApiError(error) {
  if (error?.code === "ERR_NETWORK") {
    return "Network Error. Backend is not running or API URL is wrong.";
  }

  if (error?.code === "ECONNABORTED") {
    return "Request timeout. Backend took too long to respond.";
  }

  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong"
  );
}

export default api;
