import axios from "axios";

// NEXT_PUBLIC_ prefix is required for client-side access in Next.js.
// Falls back to localhost:5000 for local development.
const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "http://localhost:5000",
  withCredentials: true,
});

export default axiosInstance;
