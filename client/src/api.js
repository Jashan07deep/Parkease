import axios from 'axios';

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', timeout: 10000 });

// --- credentials -------------------------------------------------------------
const ADMIN_KEY = 'parkease.admin';
const STUDENT_KEY = 'parkease.token';
let adminToken = sessionStorage.getItem(ADMIN_KEY) || '';
let studentToken = localStorage.getItem(STUDENT_KEY) || '';
let onSessionExpired = () => {};

export const hasStudentToken = () => !!studentToken;
export const hasAdminToken = () => !!adminToken;
export const setStudentToken = (t) => {
  studentToken = t || '';
  if (t) localStorage.setItem(STUDENT_KEY, t); else localStorage.removeItem(STUDENT_KEY);
};
export const setAdminToken = (t) => {
  adminToken = t || '';
  if (t) sessionStorage.setItem(ADMIN_KEY, t); else sessionStorage.removeItem(ADMIN_KEY);
};
export const setSessionExpiredHandler = (fn) => { onSessionExpired = fn; };

http.interceptors.request.use((c) => {
  if (studentToken) c.headers.Authorization = `Bearer ${studentToken}`;
  if (adminToken) c.headers['x-admin-token'] = adminToken;
  return c;
});
// A 401 on anything except the login/register calls means the saved session is no longer valid.
http.interceptors.response.use((r) => r, (e) => {
  const url = e.config?.url || '';
  if (e.response?.status === 401 && studentToken && !url.startsWith('/auth/') && !url.startsWith('/admin/')) onSessionExpired();
  return Promise.reject(e);
});

export const errMsg = (e) =>
  e.response?.data?.error || (e.request ? 'Cannot reach the server. Check that the API is running.' : e.message);

const d = (p) => p.then((r) => r.data);
export const api = {
  health: () => d(http.get('/health')),
  zones: () => d(http.get('/zones')),
  slots: () => d(http.get('/slots')),
  bookings: () => d(http.get('/bookings')),
  allBookings: () => d(http.get('/bookings', { params: { all: 1 } })),
  book: (b) => d(http.post('/bookings', b)),
  endBooking: (id, kind) => d(http.post(`/bookings/${id}/${kind}`)),

  register: (b) => d(http.post('/auth/register', b)),
  login: (b) => d(http.post('/auth/login', b)),
  logout: () => d(http.post('/auth/logout')),
  me: () => d(http.get('/auth/me')),
  saveProfile: (b) => d(http.put('/auth/me', b)),
  changePassword: (b) => d(http.put('/auth/password', b)),

  adminLogin: (pin) => d(http.post('/admin/login', { pin })),
  adminSession: () => d(http.get('/admin/session')),
  adminStats: () => d(http.get('/admin/stats')),
  createSlot: (b) => d(http.post('/slots', b)),
  updateSlot: (id, b) => d(http.put(`/slots/${id}`, b)),
  deleteSlot: (id) => d(http.delete(`/slots/${id}`)),
  createZone: (b) => d(http.post('/zones', b)),
  updateZone: (id, b) => d(http.put(`/zones/${id}`, b)),
  deleteZone: (id) => d(http.delete(`/zones/${id}`)),
};
