# MyDoctor Platform - Backend Documentation (Day 3+)

## 📋 Overview

This document covers all features implemented **after PROJECT_DOCUMENTATION_2.md**: Patient/Doctor dashboards, communication system with access control, medical records, appointment workflows, and enhanced authentication.

**Date:** After PROJECT_DOCUMENTATION_2  
**Focus:** Dashboards, Communication System, Medical Records, Enhanced Workflows

---

## 🆕 New Features

1. **Patient Dashboard** - Statistics, appointment/payment history, medical records management
2. **Doctor Dashboard** - Comprehensive metrics, profile strength, subscription status
3. **Communication System** - Chat & Video with appointment-based time-locked access control
4. **Medical Records** - Patients can upload, view, delete medical records (prescriptions, lab reports, etc.)
5. **Specialization Management** - Admin creates, doctors select from available list
6. **Appointment Workflow** - Accept/reject/cancel with notifications
7. **Patient Auto-Approval** - Patients auto-approved on registration
8. **Profile Completion Logic** - Automatic calculation for doctor profiles
9. **Doctor Subscription Tracking** - DoctorSubscription model for individual subscriptions
10. **Payment History** - Patients can view payment transactions

---

## 🗄️ New Models

### MedicalRecord Model
**Location:** `src/models/medicalRecord.model.js`
```javascript
{
  patientId: ObjectId (ref: User, required),
  title: String (required),
  recordType: "PRESCRIPTION" | "LAB_REPORT" | "TEST_RESULT" | "IMAGE" | "PDF" | "OTHER",
  fileUrl: String (required),
  relatedAppointmentId: ObjectId (optional),
  relatedDoctorId: ObjectId (optional),
  timestamps: true
}
```

### DoctorSubscription Model
**Location:** `src/models/doctorSubscription.model.js`
```javascript
{
  doctorId: ObjectId (ref: User, required),
  planId: ObjectId (ref: SubscriptionPlan, required),
  startDate: Date (required),
  endDate: Date (required),
  status: "ACTIVE" | "EXPIRED" | "CANCELLED",
  transactionId: ObjectId (optional),
  timestamps: true
}
```

---

## 🔄 Updated Models

- **DoctorProfile:** Added `profileCompleted: Boolean` - Auto-calculated based on title, biography, specialization, clinics, services
- **Conversation:** Added `appointmentId: ObjectId (required)` - Links conversation to appointment
- **ChatMessage:** Added `appointmentId: ObjectId (required)` - Links message to appointment
- **Appointment:** Added `REJECTED` status, `notes: String` field
- **User:** Enhanced pre-save hook (prevents double-hashing), patients default to `APPROVED`, doctors default to `PENDING`

---

## 🛡️ New Middleware

### AppointmentAccess Middleware
**Location:** `src/middleware/appointmentAccess.js`

- **`requireAppointmentAccess`** - Validates appointment is `CONFIRMED` and time has started
- **`requireConfirmedAppointment`** - Validates appointment is `CONFIRMED` (no time check)
- **`isAppointmentTimeStarted(date, time)`** - Helper to check if appointment time has started

**Usage:** Applied to chat and video routes to enforce time-based access control

---

## 🔧 New Services

### Patient Service (`src/services/patient.service.js`)
- `getPatientDashboard(patientId)` - Dashboard stats, appointments, doctors visited, reviews, notifications
- `getAppointmentHistory(patientId, options)` - Filtered appointment history with pagination
- `getPaymentHistory(patientId, options)` - Payment transactions with doctor names
- `createMedicalRecord(patientId, data)` - Create medical record
- `getMedicalRecords(patientId, options)` - Get records with filters
- `deleteMedicalRecord(recordId, patientId)` - Delete record

### Enhanced Services
- **Doctor Service:** `getDoctorDashboard()`, `getDoctorReviews()`, profile completion calculation, specialization validation
- **Appointment Service:** `acceptAppointment()`, `rejectAppointment()`, `cancelAppointment()`, enhanced validation
- **Chat Service:** Appointment validation, time checking, appointment linking
- **Video Session Service:** Appointment validation, time checking, ONLINE type validation
- **Admin Service:** `getAllReviews()`, `getAllPaymentTransactions()`
- **Auth Service:** Patient auto-approval, pending doctor login with message

---

## 🎮 New Controllers

### Patient Controller (`src/controllers/patient.controller.js`)
- `getDashboard` - `GET /api/patient/dashboard`
- `getAppointmentHistory` - `GET /api/patient/appointments/history`
- `getPaymentHistory` - `GET /api/patient/payments/history`
- `createMedicalRecord` - `POST /api/patient/medical-records`
- `getMedicalRecords` - `GET /api/patient/medical-records`
- `deleteMedicalRecord` - `DELETE /api/patient/medical-records/:id`

### Enhanced Controllers
- **Doctor:** `getDashboard()`, `getReviews()`
- **Appointment:** `accept()`, `reject()`, `cancel()`
- **Admin:** `getAllReviews()`, `getAllPaymentTransactions()`, `updateProfile()`
- **Chat/Video:** Updated to require `appointmentId` and use access middleware

---

## 🛣️ New Routes

### Patient Routes (`src/routes/patient.routes.js`)
```
GET    /api/patient/dashboard
GET    /api/patient/appointments/history
GET    /api/patient/payments/history
POST   /api/patient/medical-records
GET    /api/patient/medical-records
DELETE /api/patient/medical-records/:id
```

### Enhanced Routes
- **Appointment:** `POST /api/appointment/:id/accept`, `/reject`, `/cancel`
- **Chat:** Now requires `appointmentId`, uses `requireAppointmentAccess`
- **Video:** Now requires `appointmentId`, uses `requireAppointmentAccess`

---

## 💬 Communication System

### Rules
1. **Appointment Acceptance Required:** Doctor must accept (status: `CONFIRMED`) before communication
2. **Time-Based Access:** Communication only available at scheduled appointment date/time
3. **Status Restrictions:** PENDING/REJECTED appointments have communication disabled
4. **Chat:** REST API based (no sockets), each conversation linked to appointment
5. **Video/Audio:** Only for `ONLINE` appointments, both doctor/patient can start

### Endpoints
- `POST /api/chat/conversation` - Requires appointmentId, CONFIRMED status, time started
- `POST /api/chat/send` - Requires appointmentId, CONFIRMED status, time started
- `POST /api/video/start` - Requires appointmentId, CONFIRMED status, time started, ONLINE type
- `GET /api/video/by-appointment/:appointmentId` - Requires CONFIRMED status

### Error Messages
- PENDING: "Appointment is pending doctor acceptance..."
- REJECTED: "This appointment was rejected. Communication is not available."
- Before Time: "Communication is only available at the scheduled appointment time..."

---

## 📊 Dashboard Implementations

### Patient Dashboard
**Endpoint:** `GET /api/patient/dashboard`
**Returns:** Patient info, upcoming/completed/cancelled appointments, total doctors visited, recent reviews, unread notifications, favorite doctors count

### Doctor Dashboard
**Endpoint:** `GET /api/doctor/dashboard`
**Returns:** Today's/weekly/upcoming appointments, total patients, earnings, unread messages/notifications, profile strength (0-100%), subscription status

### Admin Dashboard
**Endpoint:** `GET /api/admin/dashboard`
**Returns:** Total users/doctors/patients, pending approvals, active subscriptions, total appointments/transactions, recent activity

---

## 🏥 Medical Records

**Endpoints:**
- `POST /api/patient/medical-records` - Create record (prescription, lab report, test result, image, PDF)
- `GET /api/patient/medical-records` - Get records (filter by recordType)
- `DELETE /api/patient/medical-records/:id` - Delete record

**Features:** Upload, view, filter by type, link to appointments/doctors, pagination

---

## 🎯 Specialization Management

**Flow:**
1. Admin creates specializations (Cardiology, Dermatology, etc.)
2. Doctors view all specializations (public endpoint)
3. Doctors select specialization when creating/updating profile
4. System validates specialization exists before saving

**Endpoints:**
- `POST /api/specialization` - Create (Admin)
- `GET /api/specialization` - List all (Public)
- `PUT /api/specialization/:id` - Update (Admin)
- `DELETE /api/specialization/:id` - Delete (Admin)

---

## 🔐 Authentication Updates

### Registration
- **Patients:** Status defaults to `APPROVED` (auto-approved)
- **Doctors:** Status defaults to `PENDING` (needs admin approval)

### Login
- **Pending Doctors:** Can login but receive message: "Your account is pending admin approval..."
- **Password Handling:** Pre-save hook prevents double-hashing, checks if already hashed

### Workflow
- Patients can login and book appointments immediately
- Doctors can login, complete profile, buy subscription before approval
- Doctors not visible to patients until `APPROVED` + active subscription + profile complete

---

## 📝 Appointment Workflow

### Flow
1. **Patient Creates** → Status: `PENDING`, doctor notified
2. **Doctor Accepts** → Status: `CONFIRMED`, patient notified, communication still locked
3. **Appointment Time Starts** → Communication unlocked (chat, video, audio)
4. **Doctor Rejects** → Status: `REJECTED`, patient notified with reason
5. **Patient Cancels** → Status: `CANCELLED`, doctor notified with reason
6. **Doctor Completes** → Status: `COMPLETED`, notes added, patient can review

### New Endpoints
- `POST /api/appointment/:id/accept` - Doctor accepts (PENDING → CONFIRMED)
- `POST /api/appointment/:id/reject` - Doctor rejects (PENDING → REJECTED)
- `POST /api/appointment/:id/cancel` - Patient cancels (→ CANCELLED)

---

## 🔍 Profile Completion Logic

**Field:** `profileCompleted: Boolean` in DoctorProfile

**Calculation:** Automatically set to `true` if:
- `title` is set
- `biography` is set
- `specialization` is set
- `clinics` array has at least one clinic
- `services` array has at least one service

**Impact:** Required for appointment booking and public visibility

---

## 💳 Payment Updates

- All payments default to `"DUMMY"` payment method
- Patient payment history endpoint: `GET /api/patient/payments/history`
- Admin payment transactions: `GET /api/admin/transactions` (appointment payments only)

---

## 🛡️ Access Control Rules

### Doctor Dashboard Access
- Doctor must be `APPROVED`
- Doctor must have `ACTIVE` subscription
- Doctor must have `profileCompleted: true`

### Public Doctor Listing
- Filters: `status: 'APPROVED'` + active subscription + profile complete

### Communication Access
- Appointment status: `CONFIRMED`
- Appointment time has started
- User is doctor or patient of appointment

---

## 📋 Validators Updates

- **Chat:** `sendMessageValidator` and `createOrGetConversationValidator` now require `appointmentId`
- **Doctor:** `upsertDoctorProfileValidator` - `specializationId` is optional, supports both `specializationId` and `specialization` fields

---

## 🗂️ File Structure

### New Files
- `src/models/medicalRecord.model.js`
- `src/models/doctorSubscription.model.js`
- `src/services/patient.service.js`
- `src/controllers/patient.controller.js`
- `src/routes/patient.routes.js`
- `src/middleware/appointmentAccess.js`

### Updated Files
- Models: `doctorProfile.model.js`, `conversation.model.js`, `chatMessage.model.js`, `appointment.model.js`, `user.model.js`
- Services: `doctor.service.js`, `appointment.service.js`, `chat.service.js`, `videoSession.service.js`, `admin.service.js`, `auth.service.js`
- Controllers: `doctor.controller.js`, `appointment.controller.js`, `admin.controller.js`, `chat.controller.js`
- Routes: `appointment.routes.js`, `chat.routes.js`, `videoSession.routes.js`
- Validators: `chat.validators.js`, `doctor.validators.js`

---

## 📊 Summary

### New Endpoints: 15+
- Patient: 6 endpoints (dashboard, history, medical records)
- Doctor: 2 endpoints (dashboard, reviews)
- Appointment: 3 endpoints (accept, reject, cancel)
- Admin: 3 endpoints (reviews, transactions, profile)
- Communication: Updated with appointment requirements

### Key Features
✅ Patient Dashboard with statistics  
✅ Medical Records Management  
✅ Doctor Dashboard with metrics  
✅ Communication System with time-locked access  
✅ Specialization Management  
✅ Appointment Workflow (accept/reject/cancel)  
✅ Patient Auto-Approval  
✅ Profile Completion Logic  
✅ Payment History  
✅ Enhanced Error Handling  

---

## ✅ Status

**All Features:** ✅ Complete  
**Testing:** ✅ Complete (test.http)  
**Documentation:** ✅ Complete

**Architecture:** Layered (Routes → Controllers → Services → Models)
