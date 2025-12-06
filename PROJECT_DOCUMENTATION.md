# MyDoctor Platform - Backend Documentation

## 📋 Overview

Express.js backend with MongoDB, JWT auth, layered architecture.

**Stack:** Node.js, Express, MongoDB, Mongoose, JWT, Zod, Multer

---

## 🏗️ Architecture

```
Routes → Controllers → Services → Models
         ↓
    Middleware (Auth, Validation, Errors)
```

---

## 📁 Structure

```
src/
├── app.js, server.js
├── config/ (env.js, database.js, upload.js)
├── controllers/ (15 files)
├── services/ (15 files)
├── models/ (15 files)
├── validators/ (14 files)
├── middleware/ (6 files)
├── routes/ (16 files)
└── uploads/
```

---

## 🗄️ Models (15)

User, DoctorProfile, Specialization, SubscriptionPlan, Appointment, VideoSession, ChatMessage, Conversation, Product, Pharmacy, Review, Favorite, BlogPost, Notification, Transaction

**All fields nullable/optional**

---

## 🔐 Auth

- JWT with `JWT_SECRET` & `REFRESH_TOKEN_SECRET`
- Roles: ADMIN, DOCTOR, PATIENT
- Password: Bcrypt hashing
- Middleware: `authGuard([...roles])`

---

## ✅ Validation

14 Zod validator files. Usage: `validate(validatorSchema)`

---

## 🛡️ Middleware (6)

1. asyncHandler - Async wrapper
2. validate - Zod validation
3. authGuard - JWT + roles
4. errorHandler - Global errors
5. requestLogger - Logging
6. upload.middleware - File uploads

---

## 🔧 Services (15)

Business logic layer. Files: auth, user, doctor, appointment, review, product, pharmacy, blog, chat, notification, transaction, subscription, specialization, favorite, videoSession

---

## 🎮 Controllers (15)

All use `asyncHandler`, call services, return: `{ success: true, message: "OK", data: result }`

---

## 🛣️ API Routes

All under `/api`:

- `/auth` - register, login, approve-doctor, change-password
- `/users` - CRUD (Admin)
- `/doctor` - profile, list
- `/appointment` - create, update, list
- `/products` - CRUD (Doctor/Pharmacy)
- `/upload` - profile, doctor-docs, clinic, product, blog, pharmacy, general
- `/specialization`, `/subscription`, `/video`, `/chat`, `/pharmacy`, `/reviews`, `/favorite`, `/blog`, `/notification`, `/transaction`

**Total:** 50+ endpoints

---

## 📤 File Upload

- Storage: `/uploads/<folder>/`
- Max: 5MB, Types: JPEG/PNG/WebP
- Folders: profile, doctor-documents, clinic, product, blog, pharmacy, general
- Access: `http://localhost:PORT/uploads/<folder>/<file>`

---

## ⚙️ Config

**env.js:** Required: MONGO_URI, JWT_SECRET, REFRESH_TOKEN_SECRET, PORT  
**database.js:** MongoDB connection  
**upload.js:** Multer config

---

## 🚀 Quick Start

```bash
# 1. Install
npm install

# 2. Create .env
PORT=3000
MONGO_URI=mongodb://localhost:27017/mydoctore
JWT_SECRET=your-secret
REFRESH_TOKEN_SECRET=your-refresh-secret

# 3. Run
npm run dev
```

Server: `http://localhost:3000`  
Health: `GET /api/health`

---

## 📦 Dependencies

express, mongoose, jsonwebtoken, bcryptjs, zod, multer, cors, dotenv

---

## 📝 Response Format

**Success:**
```json
{ "success": true, "message": "OK", "data": {} }
```

**Error:**
```json
{ "success": false, "message": "Error", "errors": [] }
```

---

## 🔑 Features

✅ JWT auth + role-based access  
✅ Zod validation  
✅ File uploads (Multer)  
✅ Error handling  
✅ Password hashing  
✅ Double-booking prevention  
✅ Rating calculation  

---

## 📊 Summary

- **Models:** 15
- **Validators:** 14
- **Services:** 15
- **Controllers:** 15
- **Routes:** 16
- **Middleware:** 6
- **Total:** 100+ files

**Status:** ✅ Complete  
**Architecture:** Layered (Routes → Controllers → Services → Models)
