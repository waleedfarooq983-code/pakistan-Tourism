# Discover Pakistan — Production Backend API

Production-ready Node.js & Express REST API for **Discover Pakistan** tourism web platform.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your MongoDB connection string is set in `MONGODB_URI`. For local MongoDB:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/discover_pakistan
```
Or for MongoDB Atlas:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/discover_pakistan?retryWrites=true&w=majority
```

### 3. Seed Database
Seeds 1 Admin account (`admin@discoverpakistan.pk` / `admin123`), 10 Destinations, and 12 Tours:
```bash
npm run seed
```

### 4. Start Server
Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Default URL: `http://localhost:5000`  
Health check: `http://localhost:5000/api/health`

---

## 🛡️ Security Features
- **Password Hashing:** 12-round bcrypt.
- **Session Tokens:** 15-minute JWT access token + 7-day refresh token stored in `httpOnly` secure cookies.
- **OTP Protection:** Codes are hashed in the database, rate-limited to 3 sends/hour, and expire automatically after 5 minutes via MongoDB TTL indexes.
- **Server-Side Price Calculation:** Tour prices and totals are strictly calculated from the database; client-supplied totals are never trusted.
- **Input Sanitization & Validation:** All strings are stripped of HTML tags via `sanitize-html` and validated strictly via `Zod`.
- **Rate Limiting:** Global rate limiting (100 req/15min) and strict authentication rate limiting (10 req/15min).
- **Helmet.js & CORS:** Configured security headers and domain whitelist.
- **Slug-based IDs:** Never exposes MongoDB `_id` in public URLs.

---

## 📡 API Overview

| Group | Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/signup` | Send signup OTP | Public |
| | `POST` | `/api/auth/verify-otp` | Verify OTP & create user | Public |
| | `POST` | `/api/auth/resend-otp` | Resend OTP code | Public |
| | `POST` | `/api/auth/login` | Login user & issue tokens | Public |
| | `POST` | `/api/auth/refresh` | Refresh access token | Public |
| | `POST` | `/api/auth/logout` | Clear refresh token | Public |
| | `POST` | `/api/auth/forgot-password` | Send password reset OTP | Public |
| | `POST` | `/api/auth/reset-password` | Reset password with OTP | Public |
| | `GET` | `/api/auth/me` | Current user profile | User |
| | `PATCH`| `/api/auth/me` | Update name / phone | User |
| **Destinations** | `GET` | `/api/destinations` | List destinations (filters: `region`, `featured`, `search`) | Public |
| | `GET` | `/api/destinations/:id` | Single destination by slug | Public |
| | `POST` | `/api/destinations` | Create destination | Admin |
| | `PUT` | `/api/destinations/:id` | Update destination | Admin |
| | `DELETE`| `/api/destinations/:id`| Delete destination | Admin |
| **Tours** | `GET` | `/api/tours` | List tours (filters: `type`, `region`, `destination`, `minPrice`, `maxPrice`, `search`, `sort`) | Public |
| | `GET` | `/api/tours/:id` | Single tour by slug | Public |
| | `POST` | `/api/tours` | Create tour package | Admin |
| | `PUT` | `/api/tours/:id` | Update tour package | Admin |
| | `DELETE`| `/api/tours/:id` | Delete tour package | Admin |
| **Bookings** | `POST` | `/api/bookings` | Create new booking (price computed server-side) | User |
| | `GET` | `/api/bookings/my` | User's bookings | User |
| | `GET` | `/api/bookings/:id` | Booking details (by ID or DPK reference) | Owner/Admin |
| | `PATCH`| `/api/bookings/:id/cancel` | Cancel booking | Owner/Admin |
| | `GET` | `/api/bookings` | List all bookings (paginated, search, status) | Admin |
| | `PATCH`| `/api/bookings/:id/status` | Update booking status | Admin |
| | `DELETE`| `/api/bookings/:id` | Delete booking | Admin |
| **Payments** | `POST` | `/api/payments/create-intent` | Create Stripe / JazzCash / Mock intent | User |
| | `POST` | `/api/payments/verify` | Verify payment status | User |
| | `POST` | `/api/payments/webhook` | Stripe webhook listener | Public |
| **Contact** | `POST` | `/api/contact` | Submit contact form | Public |
| | `GET` | `/api/contact` | View contact messages | Admin |
| | `PATCH`| `/api/contact/:id/read` | Mark message as read | Admin |
| | `DELETE`| `/api/contact/:id` | Delete contact message | Admin |
| **Newsletter** | `POST` | `/api/newsletter/subscribe` | Subscribe email | Public |
| | `POST` | `/api/newsletter/unsubscribe` | Unsubscribe email | Public |
| **Upload** | `POST` | `/api/upload/image` | Upload image to Cloudinary | Admin |
| **Admin** | `GET` | `/api/admin/stats` | Dashboard statistics & analytics | Admin |
| | `GET` | `/api/admin/users` | Paginated user management | Admin |
| | `PATCH`| `/api/admin/users/:id` | Activate/Deactivate user | Admin |
| | `DELETE`| `/api/admin/users/:id` | Delete user account | Admin |
| | `GET` | `/api/admin/logs` | Audit trail of admin actions | Admin |
