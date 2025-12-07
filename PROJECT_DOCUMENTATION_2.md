# MyDoctor Platform - Backend Documentation (Day 2)

## 📋 Overview

Today's work focused on implementing **Subscription Plan Management System** for doctors and covering the complete **Authentication & Authorization System**. Includes JWT-based authentication with RBAC, secure password management, and subscription monetization.

**Date:** Today  
**Focus:** Authentication System & Subscription Management

---

## 🆕 New Features

1. **Subscription Plan Management (Admin)** - CRUD operations for subscription plans with name, price, duration, features, and status
2. **Doctor Subscription Purchase** - Doctors can buy plans with automatic expiration calculation
3. **Enhanced Doctor Management (Admin)** - View/filter doctors by subscription status and account status
4. **Authentication & Authorization** - JWT-based auth with RBAC, password hashing (bcrypt), token refresh, doctor approval workflow

---

## 🔐 Authentication System

### Auth Endpoints (`/api/auth`)
- **POST** `/register` - Register DOCTOR/PATIENT (Public) - Returns user + JWT token
- **POST** `/login` - Login user (Public) - Returns user + JWT token
- **POST** `/approve-doctor` - Approve doctor (Admin only)
- **POST** `/change-password` - Change password (Authenticated)
- **POST** `/refresh-token` - Refresh JWT token (Public)

### Authentication Flow
1. **Registration:** Validates email/password → Hashes password (bcrypt, 10 rounds) → Creates user (status: PENDING) → Generates JWT → Returns user + token
2. **Login:** Validates credentials → Checks account status (blocks BLOCKED/REJECTED) → Compares password → Generates JWT → Returns user + token
3. **Token Auth:** All protected routes use `Authorization: Bearer <token>` header
4. **RBAC:** `authGuard([...roles])` middleware validates token, checks user status, enforces role permissions

### Security Features
- **Password:** bcrypt hashing (10 salt rounds), min 6 chars, never returned in responses
- **JWT:** HS256 algorithm, configurable expiration (default: 7 days), signature verification
- **Account Status:** PENDING → APPROVED (admin approval) → REJECTED/BLOCKED (cannot login)
- **Access Control:** Public routes (register/login), Protected routes (require JWT), Role-based (restrict by role)

### Components
- `auth.service.js` - registerUser, loginUser, approveDoctor, changePassword, refreshToken
- `auth.controller.js` - Request handlers for all auth endpoints
- `authGuard.js` - JWT middleware with RBAC (validates token, checks status, enforces roles)
- `jwt.js` - generateToken, verifyToken, extractToken utilities
- `auth.validators.js` - Zod validators for all auth endpoints

---

## 🗄️ Models

### SubscriptionPlan Model
```javascript
{
  name: String (required, unique),
  price: Number (required, min: 0),
  durationInDays: Number (required, min: 1),
  features: [String] (default: []),
  status: "ACTIVE" | "INACTIVE" (default: "ACTIVE"),
  timestamps: true
}
```
**Location:** `src/models/subscriptionPlan.model.js`

### User Model - New Fields
- `subscriptionPlan`: ObjectId ref to SubscriptionPlan
- `subscriptionExpiresAt`: Date for subscription expiration
**Location:** `src/models/user.model.js`

---

## 🛣️ API Routes

### Subscription Plan Routes (`/api/admin/subscription-plan`)
1. **POST** `/` - Create plan (Admin) - Body: `{ name, price, durationInDays, features[] }`
2. **GET** `/` - Get all plans (Admin) - Query: `status?`
3. **GET** `/active` - Get active plans (Public)
4. **GET** `/:id` - Get plan by ID (Admin)
5. **PUT** `/:id` - Update plan (Admin) - Body: `{ name?, price?, durationInDays?, features[]?, status? }`
6. **DELETE** `/:id` - Delete plan (Admin)

### Doctor Routes (`/api/doctor`)
7. **POST** `/buy-subscription` - Buy plan (Doctor) - Body: `{ planId }` - Auto-calculates expiration
8. **GET** `/my-subscription` - Get current subscription (Doctor)

### Admin Routes (`/api/admin`)
9. **GET** `/doctors` - List doctors with filters (Admin) - Query: `status?, subscriptionStatus?, search?, page?, limit?`

---

## 🔧 Services

- **subscriptionPlan.service.js** - createPlan, getAllPlans, getActivePlans, getPlanById, updatePlan, deletePlan
- **doctor.service.js** - buySubscriptionPlan, getMySubscriptionPlan
- **user.service.js** - listDoctors (with subscription filtering)

---

## 🎮 Controllers

- **subscriptionPlan.controller.js** - createPlan, getAllPlans, getActivePlans, getPlanById, updatePlan, deletePlan
- **doctor.controller.js** - buySubscriptionPlan, getMySubscriptionPlan
- **user.controller.js** - listDoctors

---

## ✅ Validators

- **subscriptionPlan.validators.js** - subscriptionPlanCreateValidator, subscriptionPlanUpdateValidator
- **doctor.validators.js** - buySubscriptionPlanValidator

---

## 🔐 Business Logic

### Subscription Purchase Flow
1. Doctor selects plan → Validates doctor role & plan status → Calculates expiration (currentDate + durationInDays) → Updates user subscription fields → Returns details

### Subscription Status
- **ACTIVE:** Has subscriptionPlan AND expirationDate > now
- **EXPIRED:** Has subscriptionPlan BUT expirationDate <= now
- **NONE:** No subscriptionPlan assigned

### Plan Name Uniqueness
- Case-insensitive duplicate check on create/update

---

## 📤 File Structure

```
src/
├── models/
│   ├── subscriptionPlan.model.js (NEW)
│   └── user.model.js (UPDATED - subscription fields)
├── services/
│   ├── subscriptionPlan.service.js (NEW)
│   ├── auth.service.js (EXISTS)
│   ├── doctor.service.js (UPDATED)
│   └── user.service.js (UPDATED)
├── controllers/
│   ├── subscriptionPlan.controller.js (NEW)
│   ├── auth.controller.js (EXISTS)
│   ├── doctor.controller.js (UPDATED)
│   └── user.controller.js (UPDATED)
├── routes/
│   ├── subscriptionPlan.routes.js (NEW)
│   ├── auth.routes.js (EXISTS)
│   ├── doctor.routes.js (UPDATED)
│   └── admin.routes.js (UPDATED)
├── validators/
│   ├── subscriptionPlan.validators.js (NEW)
│   ├── auth.validators.js (EXISTS)
│   └── doctor.validators.js (UPDATED)
└── middleware/
    └── authGuard.js (EXISTS)
```

---

## 📊 Summary

### New Files: 5
- Models: 1 (SubscriptionPlan)
- Services: 1 (subscriptionPlan.service.js)
- Controllers: 1 (subscriptionPlan.controller.js)
- Routes: 1 (subscriptionPlan.routes.js)
- Validators: 1 (subscriptionPlan.validators.js)

### Updated Files: 6
- Models: 1 (user.model.js)
- Services: 2 (doctor.service.js, user.service.js)
- Controllers: 2 (doctor.controller.js, user.controller.js)
- Routes: 2 (doctor.routes.js, admin.routes.js)
- Validators: 1 (doctor.validators.js)

### Endpoints
- **Authentication:** 5 endpoints (register, login, approve-doctor, change-password, refresh-token)
- **Subscription:** 9 endpoints (6 admin plan CRUD, 2 doctor subscription, 1 admin doctor list)
- **Total Today:** 14 endpoints covered
- **System Total:** 59+ endpoints

---

## 🔑 Key Features

✅ JWT authentication with RBAC  
✅ Secure password hashing (bcrypt)  
✅ Token refresh mechanism  
✅ Account status management  
✅ Subscription plan CRUD (Admin)  
✅ Doctor subscription purchase  
✅ Auto-expiration calculation  
✅ Subscription status tracking  
✅ Admin doctor filtering  
✅ Zod validation  

---

## 📝 Notes

- Passwords: bcrypt hashed (10 rounds), never returned in responses
- JWT: Bearer token in Authorization header, configurable expiration
- Account Status: PENDING → APPROVED (admin) → REJECTED/BLOCKED (cannot login)
- Subscription: Auto-expiration calculation, only ACTIVE plans purchasable, unique plan names
- All endpoints use consistent auth/validation patterns

---

## ✅ Status

**Authentication System:** ✅ Complete  
**Subscription Management:** ✅ Complete  
**Doctor Subscription Purchase:** ✅ Complete  
**Admin Doctor Management:** ✅ Complete  
**Testing:** ✅ Complete (test.http)

**Architecture:** Layered (Routes → Controllers → Services → Models)
