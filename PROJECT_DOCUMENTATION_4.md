# MyDoctor Platform - Backend Documentation (Day 4+)

## 📋 Overview

This document covers all features implemented **after PROJECT_DOCUMENTATION_3.md**: Product management enhancements, admin product support, and admin-doctor communication system.

**Date:** After PROJECT_DOCUMENTATION_3  
**Focus:** Product Management, Admin Features, Admin-Doctor Communication

---

## 🆕 New Features

1. **Product Management Enhancements** - Auto-set seller info, FULL subscription requirement for doctors
2. **Admin Product Support** - Admin can create/manage products shown on website
3. **Admin-Doctor Chat System** - Direct communication without appointments (REST API)
4. **Product Visibility** - Products shown in doctor profiles and public listings
5. **Enhanced Product Security** - Ownership verification, subscription checks

---

## 🔄 Updated Models

### Product Model
**Location:** `src/models/product.model.js`
- Added `"ADMIN"` to `sellerType` enum: `["DOCTOR", "PHARMACY", "ADMIN"]`

### Conversation Model
**Location:** `src/models/conversation.model.js`
- Added `adminId: ObjectId (ref: User, optional)` - For admin-doctor conversations
- Made `appointmentId` optional (required only for doctor-patient conversations)
- Added `conversationType: "DOCTOR_PATIENT" | "ADMIN_DOCTOR"` - Distinguishes conversation types

### ChatMessage Model
**Location:** `src/models/chatMessage.model.js`
- Added `adminId: ObjectId (ref: User, optional)` - For admin-doctor messages
- Made `appointmentId` optional (only for doctor-patient messages)

---

## 🔧 Enhanced Services

### Product Service (`src/services/product.service.js`)
**Changes:**
- **Auto-set seller info:** `sellerId` and `sellerType` automatically set from authenticated user
- **FULL subscription check:** Doctors must have FULL subscription plan to create/update products
- **Admin support:** Admin can create products without subscription requirement
- **Enhanced security:** Ownership verification for update/delete operations
- **Admin permissions:** Admin can update/delete any product (not just their own)

**Key Functions:**
- `createProduct()` - Validates FULL subscription for doctors, allows admin without subscription
- `updateProduct()` - Verifies ownership, checks FULL subscription for doctors, allows admin full access
- `deleteProduct()` - Verifies ownership, allows admin to delete any product

### Doctor Service (`src/services/doctor.service.js`)
**Changes:**
- **Product integration:** `getDoctorProfile()` includes products array (up to 20 products)
- **Listing enhancement:** `listDoctors()` includes products array (up to 5 products per doctor)

### Chat Service (`src/services/chat.service.js`)
**Changes:**
- **Dual conversation support:** Handles both doctor-patient (appointment-based) and admin-doctor (no appointment) conversations
- **Flexible messaging:** `sendMessage()` supports both conversation types with different validation rules
- **Conversation listing:** Added `getConversations()` for admin/doctor to view all their conversations

**Key Functions:**
- `sendMessage()` - Supports admin-doctor (no appointment) and doctor-patient (appointment required)
- `getOrCreateConversation()` - Creates conversations for both types
- `getConversations()` - Lists conversations for admin/doctor with pagination

---

## 🎮 Enhanced Controllers

### Product Controller (`src/controllers/product.controller.js`)
- `create()` - Auto-sets `sellerId` and `sellerType` from `req.userId` and `req.userRole`
- `update()` - Passes `userId` for ownership verification
- `delete()` - Passes `userId` for ownership verification

### Chat Controller (`src/controllers/chat.controller.js`)
- `sendMessage()` - Handles both admin-doctor and doctor-patient messages
- `getOrCreateConversation()` - Supports both conversation types
- `getConversations()` - **NEW** - Lists conversations for current user (admin/doctor)

---

## 🛣️ Enhanced Routes

### Product Routes (`src/routes/product.routes.js`)
- All routes now allow `ADMIN` role: `authGuard(['DOCTOR', 'PHARMACY', 'ADMIN'])`

### Chat Routes (`src/routes/chat.routes.js`)
- Conditional middleware: Appointment access check only for doctor-patient conversations
- Added `GET /api/chat/conversations` - List conversations (Admin/Doctor only)

---

## 📋 Validators Updates

### Product Validators (`src/validators/product.validators.js`)
- `createProductValidator`: `sellerId` and `sellerType` are optional (auto-set from authenticated user)
- `updateProductValidator`: Removed `sellerId` and `sellerType` (cannot be changed)
- `filterProductsValidator`: Added `"ADMIN"` to `sellerType` enum

### Chat Validators (`src/validators/chat.validators.js`)
- `sendMessageValidator`: Accepts either `adminId` (for admin-doctor) OR `patientId+appointmentId` (for doctor-patient)
- `createOrGetConversationValidator`: Same flexibility - supports both conversation types

---

## 🛍️ Product Management System

### Doctor Products
**Requirements:**
- Doctor must have **FULL subscription plan** (active)
- Products appear in doctor profile
- Products appear in doctor listing (up to 5 per doctor)
- Doctor can only manage their own products

**Endpoints:**
- `POST /api/products` - Create product (auto-sets sellerId/sellerType)
- `PUT /api/products/:id` - Update product (requires FULL subscription)
- `DELETE /api/products/:id` - Delete product

### Admin Products
**Features:**
- No subscription required
- Products shown on website (public access)
- Admin can create/update/delete any product
- Full management capabilities

**Endpoints:**
- `POST /api/products` - Create product (no subscription check)
- `PUT /api/products/:id` - Update any product
- `DELETE /api/products/:id` - Delete any product
- `GET /api/products?sellerType=ADMIN` - Get admin products

### Product Visibility
- **Doctor Profile:** Shows up to 20 products
- **Doctor Listing:** Shows up to 5 products per doctor
- **Public Listing:** All active products (Admin, Doctor, Pharmacy) visible

---

## 💬 Admin-Doctor Communication System

### Features
1. **No Appointment Required** - Admin and doctor can chat anytime
2. **No Time Restrictions** - Available 24/7 (unlike doctor-patient chat)
3. **REST API Only** - No sockets required
4. **Bidirectional** - Both admin and doctor can initiate conversations

### Conversation Types

#### Admin-Doctor Chat
- **No appointment needed**
- **Available anytime**
- **Both can initiate**
- **Request format:**
  ```json
  {
    "adminId": "ADMIN_ID",
    "doctorId": "DOCTOR_ID"
  }
  ```

#### Doctor-Patient Chat
- **Requires appointment** (CONFIRMED status)
- **Time-locked** (only at scheduled time)
- **Request format:**
  ```json
  {
    "doctorId": "DOCTOR_ID",
    "patientId": "PATIENT_ID",
    "appointmentId": "APPOINTMENT_ID"
  }
  ```

### Endpoints
- `POST /api/chat/conversation` - Create/get conversation (supports both types)
- `POST /api/chat/send` - Send message (supports both types)
- `GET /api/chat/messages/:conversationId` - Get messages
- `GET /api/chat/conversations` - List all conversations (Admin/Doctor)

---

## 🔐 Access Control Rules

### Product Management
- **Doctors:** Must have FULL subscription, can only manage own products
- **Admin:** No subscription required, can manage any product
- **Pharmacy:** Can create products (no subscription check)

### Chat Access
- **Admin-Doctor:** Always available, no restrictions
- **Doctor-Patient:** Requires CONFIRMED appointment + time started
- **Conversation Listing:** Only Admin and Doctor can list conversations

---

## 🗂️ File Structure

### Updated Files
- **Models:** `product.model.js`, `conversation.model.js`, `chatMessage.model.js`
- **Services:** `product.service.js`, `doctor.service.js`, `chat.service.js`
- **Controllers:** `product.controller.js`, `chat.controller.js`
- **Routes:** `product.routes.js`, `chat.routes.js`
- **Validators:** `product.validators.js`, `chat.validators.js`

---

## 📊 Summary

### New Endpoints: 1
- Chat: `GET /api/chat/conversations` (list conversations)

### Enhanced Endpoints: 3+
- Product: All endpoints now support ADMIN
- Chat: All endpoints support both conversation types

### Key Features
✅ Product auto-set seller info  
✅ FULL subscription requirement for doctor products  
✅ Admin product management (website products)  
✅ Products in doctor profile and listing  
✅ Admin-Doctor chat (no appointment required)  
✅ Dual conversation type support  
✅ Conversation listing for admin/doctor  
✅ Enhanced security and ownership checks  

---

## ✅ Status

**All Features:** ✅ Complete  
**Testing:** ✅ Complete (test.http)  
**Documentation:** ✅ Complete

**Architecture:** Layered (Routes → Controllers → Services → Models)  
**Communication:** REST API only (no sockets)

---

## 📝 Notes

- **Product Creation:** `sellerId` and `sellerType` are automatically set from authenticated user token
- **Admin Products:** Shown on website immediately, no subscription required
- **Admin-Doctor Chat:** Works independently of appointment system
- **Doctor-Patient Chat:** Still requires appointment and time restrictions
- **All Communication:** Uses REST API (no WebSocket/socket.io required)