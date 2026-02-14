import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 10000, // 10 second timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`[API Request] ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.config.url} - Success`);
    return response;
  },
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('[API Error] Request timeout');
      error.message = 'Request timeout. Please check if backend is running.';
    } else if (error.code === 'ERR_NETWORK') {
      console.error('[API Error] Network error - Backend not reachable');
      error.message = 'Cannot connect to backend. Please ensure backend is running on port 8000.';
    } else if (error.response) {
      console.error(`[API Error] ${error.response.status}:`, error.response.data);
    } else {
      console.error('[API Error]', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
