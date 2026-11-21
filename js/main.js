/* ============================================================
   SHARED JS — Nav, modal, auth, OTP, WhatsApp, newsletter
   ============================================================ */

/* ---------- MOBILE MENU ---------- */
function initMobileMenu() {
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    if (!toggle || !nav) return;

    if (!nav.querySelector('.nav-close')) {
        const close = document.createElement('button');
        close.className = 'nav-close';
        close.innerHTML = '<i class="fas fa-times"></i>';
        close.onclick = () => nav.classList.remove('open');
        nav.appendChild(close);
    }

    // Remove old listener by replacing element (simple approach)
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);
    newToggle.addEventListener('click', () => nav.classList.toggle('open'));

    nav.querySelectorAll('a').forEach(a =>
        a.addEventListener('click', () => nav.classList.remove('open'))
    );
}

/* ---------- ACTIVE NAV LINK ---------- */
function highlightActiveNav() {
    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav a').forEach(a => {
        const href = a.getAttribute('href');
        if (href === page) a.classList.add('active');
    });
    const user = AUTH.getUser();
    const dashLink = document.querySelector('.nav-dashboard-link');
    if (dashLink && user) dashLink.style.display = 'inline-flex';
}

/* ---------- AUTH (Backed by API with localStorage sync) ---------- */
const AUTH = {
    getUser() {
        if (typeof API !== 'undefined' && API.getUser) {
            const u = API.getUser();
            if (u) return u;
        }
        try { return JSON.parse(localStorage.getItem('currentUser')) || JSON.parse(localStorage.getItem('dpk_user')); }
        catch { return null; }
    },
    setUser(user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('dpk_user', JSON.stringify(user));
    },
    isAdmin() {
        if (typeof API !== 'undefined' && API.isAdmin) {
            return API.isAdmin();
        }
        const u = this.getUser();
        return u && u.role === 'admin';
    },
    async logout() {
        if (typeof API !== 'undefined' && API.auth && API.auth.logout) {
            await API.auth.logout();
        }
        localStorage.removeItem('currentUser');
        localStorage.removeItem('dpk_user');
        localStorage.removeItem('dpk_access_token');
        localStorage.removeItem('dpk_refresh_token');
        sessionStorage.clear();
    },

    async signup(name, email, pass, phone = '') {
        if (typeof API !== 'undefined' && API.auth) {
            return API.auth.signup(name, email, phone, pass);
        }
        throw new Error('API client not loaded.');
    },

    async login(email, pass) {
        if (typeof API !== 'undefined' && API.auth) {
            const res = await API.auth.login(email, pass);
            return res.user;
        }
        throw new Error('API client not loaded.');
    }
};

/* ---------- OTP SYSTEM (Backend Connected) ---------- */
const OTP = {
    _otpTarget: null,
    _otpEmail: null,
    _otpMeta: null,
    _timerInterval: null,

    send(email, onVerified, meta = {}) {
        this._otpTarget = onVerified;
        this._otpEmail = email;
        this._otpMeta = meta;

        this._showOTPModal(email, meta.demoCode || null);
    },

    _showOTPModal(email, demoCode) {
        const old = document.getElementById('otpModal');
        if (old) old.remove();

        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal-backdrop active" id="otpModal">
                <div class="modal" style="max-width:440px;">
                    <button class="modal-close" onclick="OTP.close()"><i class="fas fa-times"></i></button>

                    <div style="text-align:center;margin-bottom:20px;">
                        <div style="width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,var(--green-50),#d4eddd);color:var(--green-700);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:1.8rem;">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <h3 style="color:var(--green-900);margin-bottom:6px;">Verify Your Email</h3>
                        <p class="sub" style="margin-bottom:0;">We've sent a 6-digit code to<br><strong style="color:var(--green-700);">${email}</strong></p>
                    </div>

                    <div class="field-group">
                        <label style="text-align:center;display:block;">Enter OTP</label>
                        <input type="text" id="otpInput" maxlength="6" inputmode="numeric"
                               placeholder="• • • • • •"
                               style="text-align:center;font-size:1.6rem;letter-spacing:12px;font-weight:700;padding:14px;">
                    </div>

                    <div id="otpError" style="color:#c0392b;font-size:.88rem;text-align:center;min-height:20px;margin-bottom:10px;"></div>

                    <button class="btn btn-primary btn-block btn-lg" id="otpVerifyBtn" onclick="OTP.verify()">
                        <i class="fas fa-check-circle"></i> Verify Code
                    </button>

                    <div style="text-align:center;margin-top:16px;font-size:.88rem;color:var(--ink-500);">
                        Didn't receive it?
                        <a onclick="OTP.resend()" style="color:var(--green-700);font-weight:600;cursor:pointer;">Resend Code</a>
                        <span id="otpTimer" style="display:block;margin-top:6px;"></span>
                    </div>

                    ${demoCode ? `
                    <div style="margin-top:20px;padding:12px 16px;background:#fff8e7;border-radius:12px;border:1px dashed var(--gold-500);font-size:.82rem;color:var(--ink-700);text-align:center;">
                        <i class="fas fa-flask" style="color:var(--gold-700);"></i>
                        <strong>Development Code:</strong> <code style="background:rgba(0,0,0,.06);padding:2px 8px;border-radius:4px;font-weight:700;">${demoCode}</code>
                        <br><small style="color:var(--ink-500);">(Sent via backend email service)</small>
                    </div>` : ''}
                </div>
            </div>
        `);

        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('otpInput').focus(), 100);

        document.getElementById('otpInput').addEventListener('input', e => {
            e.target.value = e.target.value.replace(/\D/g, '');
            if (e.target.value.length === 6) setTimeout(() => OTP.verify(), 200);
        });

        document.getElementById('otpInput').addEventListener('keypress', e => {
            if (e.key === 'Enter') OTP.verify();
        });

        this._startTimer(5 * 60);
    },

    _startTimer(seconds) {
        const el = document.getElementById('otpTimer');
        if (!el) return;
        if (this._timerInterval) clearInterval(this._timerInterval);

        let left = seconds;
        this._timerInterval = setInterval(() => {
            left--;
            if (left <= 0) {
                el.textContent = 'Code expired — click Resend';
                el.style.color = '#c0392b';
                clearInterval(this._timerInterval);
            } else {
                const m = Math.floor(left / 60);
                const s = (left % 60).toString().padStart(2, '0');
                el.textContent = `Code expires in ${m}:${s}`;
                el.style.color = 'var(--ink-500)';
            }
        }, 1000);
    },

    async verify() {
        const input = document.getElementById('otpInput');
        const errEl = document.getElementById('otpError');
        const btn = document.getElementById('otpVerifyBtn');
        const entered = input.value.trim();
        const email = this._otpEmail;

        errEl.textContent = '';
        if (entered.length !== 6) { errEl.textContent = 'Please enter all 6 digits.'; return; }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying…';
        }

        try {
            if (typeof API !== 'undefined' && API.auth) {
                const purpose = this._otpMeta?.purpose || 'signup';
                await API.auth.verifyOtp(email, entered, purpose, this._otpMeta || {});
            }

            this.close();
            if (typeof showToast === 'function') showToast('Verified! ✅', 'success');
            if (this._otpTarget) this._otpTarget();
        } catch (err) {
            errEl.textContent = err.message || 'Incorrect verification code.';
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-check-circle"></i> Verify Code';
            }
            input.value = '';
            input.focus();
        }
    },

    async resend() {
        const email = this._otpEmail;
        if (!email) return;

        try {
            const purpose = this._otpMeta?.purpose || 'signup';
            const phone = this._otpMeta?.phone;
            const res = await API.auth.resendOtp(email, purpose, phone);

            if (res.demoCode) {
                const demoBox = document.querySelector('#otpModal code');
                if (demoBox) demoBox.textContent = res.demoCode;
            }

            document.getElementById('otpError').textContent = '';
            document.getElementById('otpInput').value = '';
            document.getElementById('otpInput').focus();
            this._startTimer(5 * 60);
            if (typeof showToast === 'function') showToast('New code sent 📧', 'info');
        } catch (err) {
            document.getElementById('otpError').textContent = err.message || 'Resend failed.';
        }
    },

    close() {
        const m = document.getElementById('otpModal');
        if (m) m.remove();
        document.body.style.overflow = '';
        if (this._timerInterval) clearInterval(this._timerInterval);
    }
};

/* ---------- AUTH MODAL (kept for backward compat, but not used) ---------- */
let authMode = 'login';

function ensureAuthModal() {
    if (document.getElementById('authModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-backdrop" id="authModal">
            <div class="modal">
                <button class="modal-close" onclick="closeAuthModal()"><i class="fas fa-times"></i></button>
                <h3 id="authTitle">Welcome Back</h3>
                <p class="sub" id="authSub">Login to continue your journey</p>
                <form id="authForm" onsubmit="return handleAuth(event)">
                    <div class="field-group hidden" id="nameField">
                        <label>Full Name</label>
                        <input type="text" id="authName" placeholder="Your full name">
                    </div>
                    <div class="field-group">
                        <label>Email Address</label>
                        <input type="email" id="authEmail" placeholder="you@example.com" required>
                    </div>
                    <div class="field-group">
                        <label>Password</label>
                        <input type="password" id="authPass" placeholder="••••••••" required minlength="6">
                    </div>
                    <button type="submit" class="btn btn-primary btn-block" id="authSubmit">Login</button>
                </form>
                <p class="modal-switch">
                    <span id="switchText">Don't have an account?</span>
                    <a onclick="toggleAuthMode()" id="switchLink">Sign Up</a>
                </p>
            </div>
        </div>
    `);
}

function openAuthModal(mode = 'login') {
    // Redirect to dedicated pages instead of modal
    if (mode === 'signup') {
        window.location.href = 'signup.html';
    } else {
        window.location.href = 'login.html';
    }
}
function closeAuthModal() {
    const m = document.getElementById('authModal');
    if (m) m.classList.remove('active');
    document.body.style.overflow = '';
}
function toggleAuthMode() {
    authMode = authMode === 'login' ? 'signup' : 'login';
    updateAuthModal();
}
function updateAuthModal() {
    const el = document.getElementById('authTitle');
    if (!el) return;
    const isLogin = authMode === 'login';
    el.textContent = isLogin ? 'Welcome Back' : 'Create Account';
    document.getElementById('authSub').textContent = isLogin ? 'Login to continue your journey' : 'Sign up to start exploring Pakistan';
    document.getElementById('authSubmit').textContent = isLogin ? 'Login' : 'Sign Up';
    document.getElementById('nameField').classList.toggle('hidden', isLogin);
    document.getElementById('switchText').textContent = isLogin ? "Don't have an account?" : "Already have an account?";
    document.getElementById('switchLink').textContent = isLogin ? 'Sign Up' : 'Login';
}

function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const pass = document.getElementById('authPass').value;
    const name = document.getElementById('authName') ? document.getElementById('authName').value.trim() : '';

    try {
        if (authMode === 'signup') {
            if (!name) throw new Error('Please enter your name');
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            if (users.find(u => u.email === email)) throw new Error('Email already registered');

            OTP.send(email, function() {
                try {
                    AUTH.signup(name, email, pass);
                    showToast(`Welcome, ${name.split(' ')[0]}! 🎉`, 'success');
                    closeAuthModal();
                    setTimeout(() => location.href = 'dashboard.html', 600);
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        } else {
            const u = AUTH.login(email, pass);
            showToast(`Welcome back, ${u.name.split(' ')[0]}!`, 'success');
            closeAuthModal();
            setTimeout(() => {
                location.href = u.role === 'admin' ? 'admin.html' : 'dashboard.html';
            }, 600);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
    return false;
}

/* ---------- RENDER HEADER AUTH ---------- */
function renderAuthUI() {
    const box = document.querySelector('.header-actions');
    if (!box) return;
    const user = AUTH.getUser();

    if (user) {
        const initial = user.name.charAt(0).toUpperCase();
        const isAdmin = user.role === 'admin';
        box.innerHTML = `
            <div class="user-menu">
                <button class="user-menu-btn" onclick="toggleUserMenu(event)">
                    <span class="user-avatar" style="${isAdmin ? 'background:linear-gradient(135deg,#c9a24c,#a07a2c);' : ''}">${initial}</span>
                    <span class="user-name">${user.name.split(' ')[0]}${isAdmin ? ' <span style="background:var(--gold-500);color:var(--green-900);padding:2px 8px;border-radius:20px;font-size:.62rem;font-weight:700;letter-spacing:.5px;margin-left:6px;">ADMIN</span>' : ''}</span>
                    <i class="fas fa-chevron-down" style="font-size:.7rem;"></i>
                </button>
                <div class="user-dropdown" id="userDropdown">
                    ${isAdmin ? `
                        <a href="admin.html"><i class="fas fa-shield-alt"></i> Admin Panel</a>
                        <a href="admin.html#bookings"><i class="fas fa-suitcase-rolling"></i> All Bookings</a>
                        <a href="admin.html#users"><i class="fas fa-users"></i> Manage Users</a>
                        <a href="admin.html#tours"><i class="fas fa-route"></i> Manage Tours</a>
                    ` : `
                        <a href="dashboard.html"><i class="fas fa-tachometer-alt"></i> My Dashboard</a>
                        <a href="dashboard.html#bookings"><i class="fas fa-suitcase-rolling"></i> My Bookings</a>
                        <a href="tours.html"><i class="fas fa-compass"></i> Browse Tours</a>
                    `}
                    <div class="dropdown-divider"></div>
                    <a onclick="logoutUser()" style="color:#c0392b;"><i class="fas fa-sign-out-alt"></i> Logout</a>
                </div>
            </div>
            <button class="menu-toggle"><i class="fas fa-bars"></i></button>
        `;
    } else {
        // Links to separate login/signup pages
        box.innerHTML = `
            <a href="login.html" class="btn btn-outline btn-sm">
                <i class="fas fa-sign-in-alt"></i> Login
            </a>
            <a href="signup.html" class="btn btn-primary btn-sm">
                <i class="fas fa-user-plus"></i> Sign Up
            </a>
            <button class="menu-toggle"><i class="fas fa-bars"></i></button>
        `;
    }
    initMobileMenu();
    document.addEventListener('click', e => {
        const dd = document.getElementById('userDropdown');
        if (dd && !e.target.closest('.user-menu')) dd.classList.remove('open');
    });
}

function toggleUserMenu(e) {
    e.stopPropagation();
    const dd = document.getElementById('userDropdown');
    if (dd) dd.classList.toggle('open');
}

async function logoutUser() {
    if (!confirm('Are you sure you want to logout?')) return;
    await AUTH.logout();
    if (typeof showToast === 'function') showToast('Logged out successfully 👋', 'info');
    setTimeout(() => { window.location.href = 'index.html'; }, 500);
}

/* ---------- TOAST ---------- */
function showToast(msg, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%) translateY(20px);
            padding: 14px 26px; border-radius: 40px; color: white; font-weight: 600;
            font-size: .92rem; z-index: 2000; opacity: 0; transition: .3s;
            box-shadow: 0 10px 30px rgba(0,0,0,.25); max-width: 90vw; text-align: center;
        `;
        document.body.appendChild(toast);
    }
    const colors = {
        success: '#12894a',
        error: '#c0392b',
        info: '#0a6b3a'
    };
    toast.style.background = colors[type] || colors.info;
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 3000);
}

/* ---------- NEWSLETTER ---------- */
async function handleNewsletter(e) {
    e.preventDefault();
    const input = e.target.querySelector('input');
    if (!input || !input.value) return;

    try {
        if (typeof API !== 'undefined' && API.newsletter) {
            await API.newsletter.subscribe(input.value.trim());
        }
        showToast('Subscribed! Check your inbox 📧', 'success');
        input.value = '';
    } catch (err) {
        showToast(err.message || 'Subscription failed', 'error');
    }
    return false;
}

/* ---------- WHATSAPP ---------- */
function injectWhatsApp() {
    if (document.querySelector('.whatsapp-float')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <a href="https://wa.me/923005289176?text=Hello%20Discover%20Pakistan!%20I%20want%20to%20know%20more."
           class="whatsapp-float" target="_blank" rel="noopener" aria-label="WhatsApp">
            <i class="fab fa-whatsapp"></i>
        </a>
        <span class="whatsapp-tooltip">Chat with us!</span>
    `);
}

/* ---------- SCROLL TO TOP ---------- */
function injectScrollTop() {
    if (document.getElementById('scrollTopBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'scrollTopBtn';
    btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    btn.style.cssText = `
        position: fixed; bottom: 100px; right: 24px; width: 46px; height: 46px;
        border-radius: 50%; background: var(--green-700); color: white;
        font-size: 1rem; z-index: 400; opacity: 0; pointer-events: none;
        transition: .3s; box-shadow: 0 6px 20px rgba(10,107,58,.35); cursor: pointer;
    `;
    btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.appendChild(btn);
    window.addEventListener('scroll', () => {
        const show = window.scrollY > 500;
        btn.style.opacity = show ? '1' : '0';
        btn.style.pointerEvents = show ? 'auto' : 'none';
    });
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    highlightActiveNav();
    renderAuthUI();
    injectWhatsApp();
    injectScrollTop();
    injectChatbot();

    // Global image fallback handler for broken external URLs
    window.addEventListener('error', function(e) {
        if (e.target && e.target.tagName === 'IMG' && !e.target.dataset.fallbackApplied) {
            e.target.dataset.fallbackApplied = 'true';
            const seed = encodeURIComponent(e.target.alt || 'pakistan');
            e.target.src = `https://picsum.photos/seed/${seed}/800/600`;
        }
    }, true);

    document.addEventListener('click', e => {
        if (e.target.classList && e.target.classList.contains('modal-backdrop')) closeAuthModal();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeAuthModal();
            closeSocialModal();
        }
    });
});

/* ============================================================
   SOCIAL AUTHENTICATION (Google & Facebook)
   ============================================================ */
function openSocialModal(provider) {
    let modal = document.getElementById('socialAuthModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'socialAuthModal';
        modal.className = 'modal-backdrop';
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.65);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999; padding: 20px; backdrop-filter: blur(4px);
        `;
        document.body.appendChild(modal);
    }

    const isGoogle = provider === 'google';
    const brandColor = isGoogle ? '#4285F4' : '#1877F2';
    const brandName = isGoogle ? 'Google' : 'Facebook';
    const brandIcon = isGoogle
        ? `<svg width="24" height="24" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z"/></svg>`
        : `<i class="fab fa-facebook-f" style="color:#1877F2;font-size:24px;"></i>`;

    modal.innerHTML = `
        <div style="background:white;width:100%;max-width:440px;border-radius:16px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
            <!-- Header -->
            <div style="padding:24px 28px 16px;border-bottom:1px solid #edf2f7;display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:12px;">
                    ${brandIcon}
                    <div>
                        <h3 style="margin:0;font-size:1.15rem;color:#1a202c;font-weight:700;">Sign in with ${brandName}</h3>
                        <p style="margin:2px 0 0;font-size:.8rem;color:#718096;">to continue to Discover Pakistan</p>
                    </div>
                </div>
                <button type="button" onclick="closeSocialModal()" style="background:none;border:none;font-size:1.2rem;color:#a0aec0;cursor:pointer;padding:4px 8px;border-radius:6px;">✕</button>
            </div>

            <!-- Body -->
            <div style="padding:24px 28px;" id="socialModalBody">
                <p style="margin:0 0 14px;font-size:.88rem;color:#4a5568;font-weight:600;">Choose an account</p>
                
                <!-- Quick Account -->
                <div onclick="performSocialLogin('${provider}', 'waleedfarooq983@gmail.com', 'M. Waleed', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100')"
                     style="display:flex;align-items:center;gap:14px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;cursor:pointer;margin-bottom:10px;transition:.2s;"
                     onmouseover="this.style.background='#f7fafc';this.style.borderColor='${brandColor}'"
                     onmouseout="this.style.background='white';this.style.borderColor='#e2e8f0'">
                    <div style="width:40px;height:40px;border-radius:50%;background:${brandColor};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1rem;">
                        W
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:700;font-size:.92rem;color:#2d3748;">M. Waleed</div>
                        <div style="font-size:.8rem;color:#718096;">waleedfarooq983@gmail.com</div>
                    </div>
                    <i class="fas fa-chevron-right" style="color:#cbd5e0;font-size:.85rem;"></i>
                </div>

                <!-- Custom Account Toggle -->
                <div style="margin-top:14px;text-align:center;">
                    <button type="button" onclick="toggleCustomSocialAccount('${provider}')" style="background:none;border:none;color:${brandColor};font-size:.86rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                        <i class="fas fa-user-plus"></i> Use another ${brandName} account
                    </button>
                </div>

                <!-- Custom Account Form -->
                <form id="customSocialForm" onsubmit="submitCustomSocial(event, '${provider}')" style="display:none;margin-top:16px;padding-top:16px;border-top:1px dashed #e2e8f0;">
                    <div style="margin-bottom:12px;">
                        <label style="display:block;font-size:.78rem;font-weight:700;color:#4a5568;margin-bottom:4px;text-transform:uppercase;">Full Name</label>
                        <input type="text" id="customSocialName" placeholder="e.g. Sarah Khan" required style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.9rem;outline:none;">
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="display:block;font-size:.78rem;font-weight:700;color:#4a5568;margin-bottom:4px;text-transform:uppercase;">${brandName} Email</label>
                        <input type="email" id="customSocialEmail" placeholder="user@gmail.com" required style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.9rem;outline:none;">
                    </div>
                    <button type="submit" style="width:100%;padding:12px;background:${brandColor};color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:.92rem;">
                        Continue with ${brandName}
                    </button>
                </form>

                <p style="margin:20px 0 0;font-size:.75rem;color:#a0aec0;text-align:center;line-height:1.4;">
                    By continuing, you agree to Discover Pakistan's Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
}

function closeSocialModal() {
    const modal = document.getElementById('socialAuthModal');
    if (modal) modal.style.display = 'none';
}

function toggleCustomSocialAccount(provider) {
    const form = document.getElementById('customSocialForm');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function submitCustomSocial(e, provider) {
    e.preventDefault();
    const name = document.getElementById('customSocialName').value.trim();
    const email = document.getElementById('customSocialEmail').value.trim();
    if (!name || !email) return;
    performSocialLogin(provider, email, name);
}

async function performSocialLogin(provider, email, name, avatar) {
    const body = document.getElementById('socialModalBody');
    if (body) {
        body.innerHTML = `
            <div style="text-align:center;padding:40px 20px;">
                <div style="display:inline-block;width:38px;height:38px;border:3px solid #edf2f7;border-top-color:#0a6b3a;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:16px;"></div>
                <h4 style="margin:0 0 6px;color:#1a202c;">Connecting to ${provider === 'google' ? 'Google' : 'Facebook'}...</h4>
                <p style="margin:0;font-size:.85rem;color:#718096;">Signing in as <strong>${email}</strong></p>
            </div>
        `;
    }

    try {
        const res = await API.auth.socialLogin(provider, email, name, avatar);
        if (res && res.success) {
            if (typeof showToast === 'function') {
                showToast(`Welcome, ${res.user.name}! Signed in with ${provider === 'google' ? 'Google' : 'Facebook'}.`, 'success');
            }
            setTimeout(() => {
                const params = new URLSearchParams(window.location.search);
                const redirect = params.get('redirect') || 'dashboard.html';
                window.location.href = redirect;
            }, 600);
        } else {
            alert(res?.message || 'Login failed. Please try again.');
            closeSocialModal();
        }
    } catch (err) {
        alert(err.message || 'Social login error occurred.');
        closeSocialModal();
    }
}

/* ---------- AI CHATBOT (under 40 lines) ---------- */
function injectChatbot() {
    if (document.getElementById('aiChatBtn')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <button id="aiChatBtn" onclick="toggleAiChat()" title="Ask AI Travel Assistant" style="position:fixed;bottom:24px;right:92px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--green-800,#0a6b3a),var(--gold-600,#c9a24c));color:#fff;border:none;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer;z-index:999;font-size:1.35rem;display:flex;align-items:center;justify-content:center;transition:.25s;"><i class="fas fa-robot"></i></button>
        <div id="aiChatBox" style="display:none;position:fixed;bottom:90px;right:24px;width:320px;height:420px;background:#fff;border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.25);z-index:9999;flex-direction:column;overflow:hidden;border:1px solid #e2e8f0;font-family:sans-serif;">
            <div style="background:linear-gradient(135deg,var(--green-900,#06381e),var(--green-700,#0a6b3a));color:#fff;padding:14px;font-weight:700;display:flex;justify-content:space-between;align-items:center;">
                <span style="display:flex;align-items:center;gap:8px;"><i class="fas fa-robot" style="color:var(--gold-400,#dfba6b);"></i> AI Travel Assistant</span>
                <button onclick="toggleAiChat()" style="background:none;border:none;color:#fff;font-size:1.1rem;cursor:pointer;">✕</button>
            </div>
            <div id="aiChatLogs" style="flex:1;padding:12px;overflow-y:auto;font-size:.88rem;display:flex;flex-direction:column;gap:8px;">
                <div style="background:#eafaf1;color:#1e4620;padding:8px 12px;border-radius:10px;align-self:flex-start;max-width:85%;">Salam! Ask me anything about our tours & packages across Pakistan.</div>
            </div>
            <form onsubmit="sendAiChat(event)" style="display:flex;border-top:1px solid #edf2f7;margin:0;background:#fff;">
                <input id="aiChatInput" placeholder="Ask about tours, prices, destinations..." style="flex:1;border:none;padding:12px;outline:none;font-size:.88rem;" required>
                <button type="submit" style="background:none;border:none;color:var(--green-700,#0a6b3a);padding:0 14px;cursor:pointer;font-size:1rem;"><i class="fas fa-paper-plane"></i></button>
            </form>
        </div>`);
}
function toggleAiChat() {
    const b = document.getElementById('aiChatBox');
    if (b) b.style.display = b.style.display === 'none' ? 'flex' : 'none';
}
async function sendAiChat(e) {
    e.preventDefault();
    const inp = document.getElementById('aiChatInput'), logs = document.getElementById('aiChatLogs');
    const msg = inp.value.trim(); if (!msg) return;
    logs.insertAdjacentHTML('beforeend', `<div style="background:#f1f3f5;color:#222;padding:8px 12px;border-radius:10px;align-self:flex-end;max-width:85%;">${msg}</div>`);
    inp.value = ''; logs.scrollTop = logs.scrollHeight;
    const typing = document.createElement('div');
    typing.innerHTML = `<div style="background:#eafaf1;color:#666;padding:8px 12px;border-radius:10px;align-self:flex-start;"><i class="fas fa-spinner fa-spin"></i> Thinking...</div>`;
    logs.appendChild(typing); logs.scrollTop = logs.scrollHeight;
    try {
        const url = (typeof API !== 'undefined' && API.getBaseUrl ? API.getBaseUrl() : 'https://pakistan-tourism-wj.up.railway.app') + '/api/chat';
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) });
        const data = await res.json();
        typing.innerHTML = `<div style="background:#eafaf1;color:#1e4620;padding:8px 12px;border-radius:10px;align-self:flex-start;max-width:85%;">${data.reply || data.message || data.error || 'No response.'}</div>`;
    } catch {
        typing.innerHTML = `<div style="background:#fde8e8;color:#c0392b;padding:8px 12px;border-radius:10px;align-self:flex-start;">Could not reach chat server.</div>`;
    }
    logs.scrollTop = logs.scrollHeight;
}