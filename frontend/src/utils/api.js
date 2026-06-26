import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL;

const api = axios.create({ baseURL: API_BASE });

// Attach admin key to every request if stored in session
api.interceptors.request.use(config => {
  const key = sessionStorage.getItem('adminKey');
  if (key) config.headers['x-admin-key'] = key;
  return config;
});

// News
export const getNews = (params = {}) => api.get('/news', { params });
export const getArticle = (id) => api.get(`/news/${id}`);
export const getTrending = () => api.get('/news/meta/trending');
export const deleteArticle = (id) => api.delete(`/news/${id}`);

// Sources
export const getSources = () => api.get('/sources');
export const addSource = (data) => api.post('/sources', data);
export const updateSource = (id, data) => api.put(`/sources/${id}`, data);
export const deleteSource = (id) => api.delete(`/sources/${id}`);
export const triggerScrape = () => api.post('/sources/scrape');

// Admin
export const verifyAdmin = (key) => api.post('/admin/verify', { key });
export const getStats = () => api.get('/admin/stats');
export const triggerPipeline = () => api.post('/admin/scrape');
export const deleteAllArticles = () => api.delete('/admin/articles/all');

export default api;
