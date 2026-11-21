/**
 * Discover Pakistan — Production API Client
 * Connects frontend to the Express/MongoDB Backend API
 * Supports JWT authentication, automatic token refresh, local fallback, and full REST calls.
 */

const API = (() => {
    // Configurable API Base URL: checks window config, localStorage, or defaults to Railway backend
    const getBaseUrl = () => {
        if (window.API_BASE_URL) return window.API_BASE_URL.replace(/\/$/, '');
        const saved = localStorage.getItem('API_BASE_URL');
        if (saved) return saved.replace(/\/$/, '');
        // Production backend on Railway
        return 'https://pakistan-tourism-wj.up.railway.app';
    };

    /* -------------------------------------------------------------
       TOKEN & AUTH STATE MANAGEMENT
    ------------------------------------------------------------- */
    const TokenManager = {
        getAccessToken: () => localStorage.getItem('dpk_access_token'),
        getRefreshToken: () => localStorage.getItem('dpk_refresh_token'),
        getUser: () => {
            try {
                const u = localStorage.getItem('dpk_user');
                return u ? JSON.parse(u) : null;
            } catch {
                return null;
            }
        },
        setTokens: (accessToken, refreshToken, user) => {
            if (accessToken) localStorage.setItem('dpk_access_token', accessToken);
            if (refreshToken) localStorage.setItem('dpk_refresh_token', refreshToken);
            if (user) {
                localStorage.setItem('dpk_user', JSON.stringify(user));
                // Maintain currentUser backward compatibility for main.js renderers
                localStorage.setItem('currentUser', JSON.stringify(user));
            }
        },
        clearTokens: () => {
            localStorage.removeItem('dpk_access_token');
            localStorage.removeItem('dpk_refresh_token');
            localStorage.removeItem('dpk_user');
            localStorage.removeItem('currentUser');
            sessionStorage.clear();
        },
        isAuthenticated: () => Boolean(TokenManager.getAccessToken() && TokenManager.getUser()),
        isAdmin: () => {
            const u = TokenManager.getUser();
            return Boolean(u && u.role === 'admin');
        }
    };

    /* -------------------------------------------------------------
       CORE HTTP REQUEST WRAPPER
    ------------------------------------------------------------- */
    async function request(endpoint, options = {}, retryOn401 = true) {
        const url = `${getBaseUrl()}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const token = TokenManager.getAccessToken();
        if (token && !headers['Authorization']) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            const res = await fetch(url, config);
            let data = null;

            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await res.json();
            } else {
                data = { message: await res.text() };
            }

            // Handle 401 Unauthorized — attempt automatic token refresh
            if (res.status === 401 && retryOn401) {
                const refreshed = await refreshToken();
                if (refreshed) {
                    return request(endpoint, options, false);
                } else {
                    TokenManager.clearTokens();
                    // If page is dashboard or admin, redirect to login
                    const currentPath = window.location.pathname;
                    if (currentPath.includes('dashboard.html') || currentPath.includes('admin.html')) {
                        window.location.href = 'login.html';
                    }
                }
            }

            if (!res.ok) {
                const errorMsg = data?.message || (data?.errors && data.errors[0]?.message) || `HTTP Error ${res.status}`;
                const err = new Error(errorMsg);
                err.status = res.status;
                err.data = data;
                throw err;
            }

            return data;
        } catch (error) {
            // Network error (server offline / unreachable)
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                console.warn(`[API] Server offline at ${getBaseUrl()}. Attempting local fallback if applicable.`);
                error.isNetworkError = true;
            }
            throw error;
        }
    }

    async function refreshToken() {
        const rToken = TokenManager.getRefreshToken();
        if (!rToken) return false;

        try {
            const res = await fetch(`${getBaseUrl()}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: rToken })
            });

            if (!res.ok) return false;
            const data = await res.json();
            if (data.accessToken) {
                TokenManager.setTokens(data.accessToken, data.refreshToken || rToken);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    /* -------------------------------------------------------------
       STATIC JSON FALLBACK HELPER (when server is offline)
    ------------------------------------------------------------- */
    const staticCache = {};
    async function loadStaticJSON(path) {
        if (staticCache[path]) return staticCache[path];
        try {
            const res = await fetch(path);
            if (!res.ok) return [];
            const data = await res.json();
            staticCache[path] = data;
            return data;
        } catch (e) {
            console.error(`[API] Failed to load static fallback ${path}:`, e);
            return [];
        }
    }

    /* -------------------------------------------------------------
       PUBLIC EXPORTS
    ------------------------------------------------------------- */
    return {
        // Base URL & Token state
        getBaseUrl,
        setBaseUrl: (url) => localStorage.setItem('API_BASE_URL', url),
        getUser: TokenManager.getUser,
        isAuthenticated: TokenManager.isAuthenticated,
        isAdmin: TokenManager.isAdmin,
        clearTokens: TokenManager.clearTokens,

        /* ---------- AUTH ---------- */
        auth: {
            async signup(name, email, phone, password) {
                return request('/api/auth/signup', {
                    method: 'POST',
                    body: JSON.stringify({ name, email, phone, password })
                });
            },
            async verifyOtp(email, code, purpose = 'signup', signupDetails = {}) {
                const res = await request('/api/auth/verify-otp', {
                    method: 'POST',
                    body: JSON.stringify({ email, code, purpose, ...signupDetails })
                });
                if (res.accessToken && res.user) {
                    TokenManager.setTokens(res.accessToken, res.refreshToken, res.user);
                }
                return res;
            },
            async resendOtp(email, purpose = 'signup', phone = null) {
                return request('/api/auth/resend-otp', {
                    method: 'POST',
                    body: JSON.stringify({ email, purpose, phone })
                });
            },
            async login(email, password) {
                const res = await request('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
                if (res.accessToken && res.user) {
                    TokenManager.setTokens(res.accessToken, res.refreshToken, res.user);
                }
                return res;
            },
            async socialLogin(provider, email, name, avatar, providerId) {
                try {
                    const res = await request('/api/auth/social-login', {
                        method: 'POST',
                        body: JSON.stringify({ provider, email, name, avatar, providerId })
                    });
                    if (res && res.accessToken && res.user) {
                        TokenManager.setTokens(res.accessToken, res.refreshToken, res.user);
                    }
                    return res;
                } catch (err) {
                    console.warn('[API] Social login online failed, using fallback:', err.message);
                    const fallbackUser = {
                        id: 'social_' + Date.now(),
                        name: name || (provider === 'google' ? 'Google Traveler' : 'Facebook Traveler'),
                        email: email,
                        phone: '',
                        role: 'user',
                        avatar: avatar || '',
                        authProvider: provider
                    };
                    TokenManager.setTokens('mock_social_jwt_' + Date.now(), 'mock_refresh_token', fallbackUser);
                    return {
                        success: true,
                        message: `Signed in with ${provider} (offline mode)`,
                        user: fallbackUser,
                        accessToken: 'mock_social_jwt_' + Date.now()
                    };
                }
            },
            async logout() {
                try {
                    await request('/api/auth/logout', { method: 'POST' });
                } catch {}
                TokenManager.clearTokens();
            },
            async forgotPassword(email) {
                return request('/api/auth/forgot-password', {
                    method: 'POST',
                    body: JSON.stringify({ email })
                });
            },
            async resetPassword(email, code, newPassword) {
                return request('/api/auth/reset-password', {
                    method: 'POST',
                    body: JSON.stringify({ email, code, newPassword })
                });
            },
            async getMe() {
                const res = await request('/api/auth/me');
                if (res.user) TokenManager.setTokens(null, null, res.user);
                return res.user;
            },
            async updateProfile(data) {
                const res = await request('/api/auth/me', {
                    method: 'PATCH',
                    body: JSON.stringify(data)
                });
                if (res.user) TokenManager.setTokens(null, null, res.user);
                return res.user;
            }
        },

        /* ---------- DESTINATIONS ---------- */
        destinations: {
            async getAll(filters = {}) {
                try {
                    const params = new URLSearchParams();
                    if (filters.region) params.append('region', filters.region);
                    if (filters.featured !== undefined) params.append('featured', filters.featured);
                    if (filters.search) params.append('search', filters.search);

                    const qs = params.toString() ? `?${params.toString()}` : '';
                    const res = await request(`/api/destinations${qs}`);
                    return res.data || [];
                } catch (err) {
                    console.warn('[API] Using static destinations fallback:', err.message);
                    let list = await loadStaticJSON('data/destinations.json');
                    if (filters.featured) list = list.filter(d => d.featured);
                    if (filters.region) list = list.filter(d => d.region === filters.region);
                    if (filters.search) {
                        const q = filters.search.toLowerCase();
                        list = list.filter(d => d.name.toLowerCase().includes(q) || d.region.toLowerCase().includes(q));
                    }
                    return list;
                }
            },
            async getById(id) {
                try {
                    const res = await request(`/api/destinations/${encodeURIComponent(id)}`);
                    return res.data;
                } catch (err) {
                    console.warn(`[API] Using static destination fallback for '${id}':`, err.message);
                    const list = await loadStaticJSON('data/destinations.json');
                    return list.find(d => d.id === id) || null;
                }
            },
            async create(data) {
                return request('/api/destinations', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            },
            async update(id, data) {
                return request(`/api/destinations/${encodeURIComponent(id)}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
            },
            async delete(id) {
                return request(`/api/destinations/${encodeURIComponent(id)}`, {
                    method: 'DELETE'
                });
            }
        },

        /* ---------- TOURS ---------- */
        tours: {
            async getAll(filters = {}) {
                try {
                    const params = new URLSearchParams();
                    if (filters.type) params.append('type', filters.type);
                    if (filters.region) params.append('region', filters.region);
                    if (filters.destinationId) params.append('destinationId', filters.destinationId);
                    if (filters.featured !== undefined) params.append('featured', filters.featured);
                    if (filters.minPrice) params.append('minPrice', filters.minPrice);
                    if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
                    if (filters.search) params.append('search', filters.search);
                    if (filters.sort) params.append('sort', filters.sort);

                    const qs = params.toString() ? `?${params.toString()}` : '';
                    const res = await request(`/api/tours${qs}`);
                    return res.data || [];
                } catch (err) {
                    console.warn('[API] Using static tours fallback:', err.message);
                    let list = await loadStaticJSON('data/tours.json');
                    if (filters.featured) list = list.filter(t => t.featured);
                    if (filters.type) list = list.filter(t => t.type === filters.type);
                    if (filters.region) list = list.filter(t => t.region === filters.region);
                    if (filters.destinationId) list = list.filter(t => t.destinationId === filters.destinationId);
                    if (filters.maxPrice) list = list.filter(t => t.price <= filters.maxPrice);
                    if (filters.search) {
                        const q = filters.search.toLowerCase();
                        list = list.filter(t => t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q));
                    }
                    if (filters.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
                    if (filters.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
                    if (filters.sort === 'rating') list.sort((a, b) => b.rating - a.rating);
                    if (filters.sort === 'duration') list.sort((a, b) => a.durationDays - b.durationDays);
                    return list;
                }
            },
            async getById(id) {
                try {
                    const res = await request(`/api/tours/${encodeURIComponent(id)}`);
                    return res.data;
                } catch (err) {
                    console.warn(`[API] Using static tour fallback for '${id}':`, err.message);
                    const list = await loadStaticJSON('data/tours.json');
                    return list.find(t => t.id === id) || null;
                }
            },
            async create(data) {
                return request('/api/tours', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            },
            async update(id, data) {
                return request(`/api/tours/${encodeURIComponent(id)}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
            },
            async delete(id) {
                return request(`/api/tours/${encodeURIComponent(id)}`, {
                    method: 'DELETE'
                });
            }
        },

        /* ---------- BOOKINGS ---------- */
        bookings: {
            async create(data) {
                return request('/api/bookings', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            },
            async getMyBookings() {
                const res = await request('/api/bookings/my');
                return res.data || [];
            },
            async getById(idOrRef) {
                const res = await request(`/api/bookings/${encodeURIComponent(idOrRef)}`);
                return res.data;
            },
            async cancel(idOrRef, reason = '') {
                return request(`/api/bookings/${encodeURIComponent(idOrRef)}/cancel`, {
                    method: 'PATCH',
                    body: JSON.stringify({ reason })
                });
            },
            async getAll(params = {}) {
                const qs = new URLSearchParams(params).toString();
                return request(`/api/bookings${qs ? '?' + qs : ''}`);
            },
            async updateStatus(idOrRef, status) {
                return request(`/api/bookings/${encodeURIComponent(idOrRef)}/status`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status })
                });
            },
            async delete(idOrRef) {
                return request(`/api/bookings/${encodeURIComponent(idOrRef)}`, {
                    method: 'DELETE'
                });
            }
        },

        /* ---------- PAYMENTS ---------- */
        payments: {
            async createIntent(bookingId, method = 'card') {
                return request('/api/payments/create-intent', {
                    method: 'POST',
                    body: JSON.stringify({ bookingId, method })
                });
            },
            async verify(bookingId, transactionId, method = 'mock') {
                return request('/api/payments/verify', {
                    method: 'POST',
                    body: JSON.stringify({ bookingId, transactionId, method })
                });
            }
        },

        /* ---------- CONTACT ---------- */
        contact: {
            async send(data) {
                return request('/api/contact', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            },
            async getAll() {
                const res = await request('/api/contact');
                return res.data || [];
            },
            async markRead(id) {
                return request(`/api/contact/${id}/read`, { method: 'PATCH' });
            },
            async delete(id) {
                return request(`/api/contact/${id}`, { method: 'DELETE' });
            }
        },

        /* ---------- NEWSLETTER ---------- */
        newsletter: {
            async subscribe(email) {
                return request('/api/newsletter/subscribe', {
                    method: 'POST',
                    body: JSON.stringify({ email })
                });
            },
            async unsubscribe(email) {
                return request('/api/newsletter/unsubscribe', {
                    method: 'POST',
                    body: JSON.stringify({ email })
                });
            }
        },

        /* ---------- ADMIN ---------- */
        admin: {
            async getStats() {
                const res = await request('/api/admin/stats');
                return res.data;
            },
            async getUsers(params = {}) {
                const qs = new URLSearchParams(params).toString();
                return request(`/api/admin/users${qs ? '?' + qs : ''}`);
            },
            async updateUser(id, data) {
                return request(`/api/admin/users/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(data)
                });
            },
            async deleteUser(id) {
                return request(`/api/admin/users/${id}`, { method: 'DELETE' });
            },
            async getLogs() {
                const res = await request('/api/admin/logs');
                return res.data || [];
            }
        },

        /* ---------- HELPERS ---------- */
        formatPrice(n) {
            return new Intl.NumberFormat('en-PK', {
                style: 'currency',
                currency: 'PKR',
                maximumFractionDigits: 0
            }).format(n);
        },

        // Backward compatibility mappings for existing templates
        async getDestinations(filters) { return this.destinations.getAll(filters); },
        async getDestination(id) { return this.destinations.getById(id); },
        async getTours(filters) { return this.tours.getAll(filters); },
        async getTour(id) { return this.tours.getById(id); }
    };
})();

// Expose API globally
window.API = API;