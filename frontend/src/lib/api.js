import axios from 'axios';

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const getDefaultBackendUrl = () => {
  const envBackendUrl = normalizeBaseUrl(process.env.REACT_APP_BACKEND_URL);
  if (envBackendUrl) {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && envBackendUrl.startsWith('http://')) {
      // Avoid mixed content in browser (https page cannot call http API directly).
      return '';
    }
    return envBackendUrl;
  }

  if (typeof window === 'undefined') return 'http://178.255.44.130:8000';

  const { hostname, port } = window.location;
  const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname);

  // If accessing specifically via the production IP directly
  if (hostname === '178.255.44.130' || hostname === '103.211.37.124') {
    return `http://${hostname}:8000`;
  }

  // Handle local development (localhost or 127.0.0.1)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }

  // In local dev (React dev server), always use local backend.
  if (port === '3000') {
    return 'http://localhost:5000';
  }

  // Accessing directly by other IP (non-dev) keeps current hosted backend behavior.
  if (isIP) {
    return `http://103.211.37.124:8000`;
  }

  // Production (Vercel/HTTPS or Nginx Reverse Proxy) - use relative URL
  // This avoids mixed content (HTTPS page calling HTTP backend)
  // When hitting https://tgp.blura.in/api/... Nginx intercepts and proxies to backend
  return '';
};

export const BACKEND_URL = getDefaultBackendUrl();
const API_URL = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'ngrok-skip-browser-warning': 'true'
  }
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error?.config?.url || '';
    const isUploadRequest = url.includes('/uploads/cloudinary');
    if (error.response && error.response.status === 401 && !isUploadRequest) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ═══════════════════════════════════════════════════════════════
//          LOCATION EXTRACTION SERVICE
// ═══════════════════════════════════════════════════════════════
const getDefaultLocationServiceUrl = () => {
  const envLocationUrl = normalizeBaseUrl(process.env.REACT_APP_LOCATION_SERVICE_URL);
  if (envLocationUrl) {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && envLocationUrl.startsWith('http://')) {
      // Route through Vercel rewrite to avoid mixed-content in production.
      return '/location-api';
    }
    return envLocationUrl;
  }

  if (typeof window === 'undefined') return 'http://localhost:5003';
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:5003';
  return '/location-api';
};

const LOCATION_SERVICE_URL = getDefaultLocationServiceUrl();

/**
 * Extract location from a single text using the location model API.
 * @param {string} text - The post/tweet text
 * @returns {Promise<{location_found, city, keyword_matched, lat, lng, confidence}>}
 */
export async function extractLocation(text) {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/location-extraction/extract-location`, { text });
    return res.data;
  } catch (err) {
    console.warn('[LocationService] extract-location failed:', err.message);
    return { location_found: false, city: null, keyword_matched: null, lat: null, lng: null, confidence: null };
  }
}

/**
 * Extract locations from multiple grievance items in batch.
 * Each item should have { id, text } and optionally { user_location, user_bio, hashtags }.
 * Uses the same 3-step cascade as TweetPulse India:
 *   Step 1: user_location → Step 2: text → Step 3: hashtags → user_bio
 * @param {Array<{id: string, text: string, user_location?: string, user_bio?: string, hashtags?: string}>} items
 * @returns {Promise<Object>} Map of id → location result
 */
export async function extractLocationsBatch(items) {
  if (!items || items.length === 0) return {};
  try {
    const res = await axios.post(`${BACKEND_URL}/api/location-extraction/extract-locations-batch`, { items });
    const results = res.data?.results || [];
    const map = {};
    for (const r of results) {
      map[r.id] = r;
    }
    return map;
  } catch (err) {
    console.warn('[LocationService] batch extract failed:', err.message);
    return {};
  }
}
//add
