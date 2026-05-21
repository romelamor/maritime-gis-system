// src/lib/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "https://maritime-backend-0gib.onrender.com",
});

// Attach access token on every request
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("access");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// Auto-refresh on 401 once, then retry
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    const original = error.config;

    if (status === 401 && !original._retry) {
      const refresh = localStorage.getItem("refresh");
      if (!refresh) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        window.location.assign("/login");
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          (import.meta.env.VITE_API_BASE || "https://maritime-backend-0gib.onrender.com") + "/api/token/refresh/",
          { refresh }
        );
        localStorage.setItem("access", data.access);

        original._retry = true;
        original.headers.Authorization = `Bearer ${data.access}`;
        return api.request(original);
      } catch (e) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
