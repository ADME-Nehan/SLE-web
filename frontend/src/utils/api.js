import axios from "axios";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(
  /\/+$/,
  ""
);

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json"
  }
});

// News
export const getNews = (params = {}) => api.get("/news", { params });
export const getCategories = () => api.get("/news/categories");
export const deleteArticle = (id) => api.delete(`/news/${id}`);

// Sources
export const getSources = () => api.get("/sources");
export const addSource = (data) => api.post("/sources", data);
export const updateSource = (id, data) => api.put(`/sources/${id}`, data);
export const deleteSource = (id) => api.delete(`/sources/${id}`);
export const fetchOneSource = (id) => api.post(`/sources/${id}/fetch`);
export const runAllSources = () => api.post("/sources/run/all");

// RSS test
export const testRssFilter = (url) => api.get("/rss/filter", { params: { url } });

export function getApiError(error) {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong"
  );
}

export default api;