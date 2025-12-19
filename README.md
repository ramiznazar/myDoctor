# MyDoctor Platform - Backend API

A comprehensive healthcare platform backend built with Express.js, MongoDB, and JWT authentication. This platform connects patients with doctors, enables online consultations, manages medical records, and provides a complete healthcare ecosystem.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)
- [Key Modules](#key-modules)
- [File Uploads](#file-uploads)
- [Environment Variables](#environment-variables)
- [Response Format](#response-format)

---

## 📋 Overview

MyDoctor Platform is a full-featured healthcare backend system that enables:

- **Patient Management**: Registration, profiles, medical records, appointment booking
- **Doctor Management**: Profiles, specializations, availability, subscription plans
- **Appointment System**: Booking, scheduling, acceptance/rejection, status tracking
- **Communication**: Real-time chat and video sessions between doctors and patients
- **E-commerce**: Product management for doctors and pharmacies
- **Reviews & Ratings**: Patient feedback system for doctors
- **Blog System**: Health articles and content management
- **Payment Processing**: Transaction management and payment history
- **Admin Dashboard**: Complete platform administration

---

## ✨ Features

### 🔐 Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (ADMIN, DOCTOR, PATIENT)
- Secure password hashing with bcrypt
- Account status management (PENDING, APPROVED, REJECTED, BLOCKED)
- Patient auto-approval on registration
- Doctor approval workflow (admin approval required)

### 👥 User Management
- **Patients**: Auto-approved registration, medical records management, appointment history
- **Doctors**: Profile management, specialization selection, subscription plans, availability scheduling
- **Admin**: Complete user management, doctor approval, platform administration

### 📅 Appointment System
- Appointment booking with date/time selection
- Multiple booking types (ONLINE, CLINIC, HOME)
- Doctor acceptance/rejection workflow
- Appointment status tracking (PENDING, CONFIRMED, REJECTED, CANCELLED, COMPLETED)
- Double-booking prevention
- Appointment history and filtering

### 💬 Communication System
- **Doctor-Patient Chat**: REST API-based chat with appointment-based access control
  - Requires CONFIRMED appointment
  - Time-locked (only available at scheduled appointment time)
- **Admin-Doctor Chat**: Direct communication without appointments
  - Available 24/7
  - No time restrictions
- **Video Sessions**: Online consultation support for ONLINE appointments
  - Start/end session tracking
  - Appointment-based access control

### 🏥 Medical Records
- Patients can upload medical records (prescriptions, lab reports, test results, images, PDFs)
- Link records to appointments and doctors
- View and manage medical history
- Filter by record type

### 💳 Subscription Management
- Admin creates subscription plans (name, price, duration, features)
- Doctors purchase subscription plans
- Automatic expiration calculation
- Subscription status tracking (ACTIVE, EXPIRED, NONE)
- FULL subscription required for product management

### 🛍️ Product Management
- Doctors can create/manage products (requires FULL subscription)
- Pharmacy product management
- Admin product support (website products)
- Products visible in doctor profiles and listings
- Auto-set seller information

### ⭐ Reviews & Ratings
- Patients can review doctors after appointments
- Rating calculation and aggregation
- Review filtering and pagination
- Admin review management

### 📝 Blog System
- Health articles and content management
- Image uploads for blog posts
- Public and admin-managed content

### 🏪 Pharmacy Management
- Pharmacy registration and profiles
- Product listings
- Integration with doctor recommendations

### 📊 Dashboards
- **Patient Dashboard**: Statistics, appointments, payment history, medical records, favorite doctors
- **Doctor Dashboard**: Today's/weekly appointments, patient count, earnings, profile strength, subscription status
- **Admin Dashboard**: Platform statistics, user counts, pending approvals, transactions

### 🔔 Notifications
- Appointment notifications
- System announcements
- Unread message counts
- Real-time updates

### 📤 File Uploads
- Profile images
- Doctor documents (certificates, licenses)
- Clinic images
- Product images
- Blog images
- Medical records
- General file uploads

---

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Validation**: Zod
- **File Upload**: Multer
- **Queue System**: BullMQ (with Redis)
- **Security**: Helmet, CORS, express-rate-limit
- **Logging**: Morgan

---

## 🏗️ Architecture

The project follows a **layered architecture** pattern:

```
Routes → Controllers → Services → Models
         ↓
    Middleware (Auth, Validation, Errors)
```

### Layer Responsibilities

- **Routes**: Define API endpoints and apply middleware
- **Controllers**: Handle HTTP requests/responses, call services
- **Services**: Implement business logic, interact with models
- **Models**: Mongoose schemas for database entities
- **Middleware**: Authentication, validation, error handling, logging
- **Validators**: Zod schemas for request validation

---

## 📁 Project Structure

```
MyDoctore_Backend/
├── src/
│   ├── app.js                    # Express app configuration
│   ├── server.js                 # Server entry point
│   ├── config/                   # Configuration files
│   │   ├── env.js               # Environment variables
│   │   ├── database.js          # MongoDB connection
│   │   └── upload.js            # Multer configuration
│   ├── controllers/              # Request handlers (20+ files)
│   │   ├── admin.controller.js
│   │   ├── appointment.controller.js
│   │   ├── auth.controller.js
│   │   ├── chat.controller.js
│   │   ├── doctor.controller.js
│   │   ├── patient.controller.js
│   │   └── ...
│   ├── services/                 # Business logic (20+ files)
│   │   ├── admin.service.js
│   │   ├── appointment.service.js
│   │   ├── auth.service.js
│   │   ├── chat.service.js
│   │   ├── doctor.service.js
│   │   ├── patient.service.js
│   │   └── ...
│   ├── models/                   # Mongoose models (20+ files)
│   │   ├── User.js
│   │   ├── doctorProfile.model.js
│   │   ├── appointment.model.js
│   │   ├── medicalRecord.model.js
│   │   └── ...
│   ├── routes/                   # API routes (20+ files)
│   │   ├── index.js             # Route registration
│   │   ├── auth.routes.js
│   │   ├── appointment.routes.js
│   │   ├── doctor.routes.js
│   │   └── ...
│   ├── validators/               # Zod validation schemas (16+ files)
│   │   ├── auth.validators.js
│   │   ├── appointment.validators.js
│   │   └── ...
│   ├── middleware/               # Express middleware
│   │   ├── asyncHandler.js      # Async error wrapper
│   │   ├── authGuard.js         # JWT + RBAC middleware
│   │   ├── validate.js          # Zod validation middleware
│   │   ├── errorHandler.js      # Global error handler
│   │   ├── requestLogger.js     # Request logging
│   │   ├── upload.middleware.js # File upload middleware
│   │   └── appointmentAccess.js # Appointment access control
│   ├── types/                    # Type definitions
│   │   ├── enums.js             # Enum values
│   │   └── global.types.js      # Global types
│   ├── utils/                    # Utility functions
│   │   └── ...
│   ├── queue/                    # BullMQ queues
│   │   └── example.queue.js
│   └── workers/                  # BullMQ workers
│       └── example.worker.js
├── uploads/                      # Uploaded files
│   ├── profile/
│   ├── doctor-documents/
│   ├── clinic/
│   ├── product/
│   ├── blog/
│   ├── pharmacy/
│   └── general/
├── test.http                     # API testing file
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or connection string)
- Redis (for BullMQ queues - optional)

### Installation

1. **Clone the repository** (or navigate to project directory)

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   NODE_ENV=development
   
   # MongoDB
   MONGO_URI=mongodb://localhost:27017/mydoctore
   
   # JWT
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   REFRESH_TOKEN_SECRET=your-refresh-token-secret
   JWT_EXPIRE=7d
   
   # Redis (for BullMQ - optional)
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

4. **Start MongoDB:**
   - Make sure MongoDB is running on your system
   - Or use a cloud MongoDB instance (MongoDB Atlas)

5. **Start Redis (optional, for queues):**
   - Required only if using BullMQ features
   - Can be skipped for basic functionality

6. **Run the application:**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

7. **Start the worker (optional, for background jobs):**
   ```bash
   node src/workers/example.worker.js
   ```

The server will start on `http://localhost:5000` (or your configured PORT)

### Health Check

```bash
GET http://localhost:5000/
# Returns: { "success": true, "message": "MyDoctor API is running" }

GET http://localhost:5000/api/health
# Returns: { "success": true, "message": "Server is running", "timestamp": "..." }
```

---

## 📡 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Main API Routes

#### Authentication (`/api/auth`)
- `POST /register` - Register new user (DOCTOR/PATIENT)
- `POST /login` - Login user
- `POST /approve-doctor` - Approve doctor (Admin only)
- `POST /change-password` - Change password (Authenticated)
- `POST /refresh-token` - Refresh JWT token

#### Users (`/api/users`)
- `GET /` - Get all users (Admin only)
- `GET /:id` - Get user by ID (Admin only)
- `PUT /:id` - Update user (Admin only)
- `DELETE /:id` - Delete user (Admin only)

#### Doctors (`/api/doctor`)
- `GET /` - List all doctors (Public, filtered by approved + active subscription)
- `GET /profile` - Get current doctor profile (Doctor only)
- `POST /profile` - Create/update doctor profile (Doctor only)
- `GET /dashboard` - Get doctor dashboard (Doctor only)
- `GET /reviews` - Get doctor reviews (Doctor only)
- `POST /buy-subscription` - Buy subscription plan (Doctor only)
- `GET /my-subscription` - Get current subscription (Doctor only)

#### Patients (`/api/patient`)
- `GET /dashboard` - Get patient dashboard (Patient only)
- `GET /appointments/history` - Get appointment history (Patient only)
- `GET /payments/history` - Get payment history (Patient only)
- `POST /medical-records` - Create medical record (Patient only)
- `GET /medical-records` - Get medical records (Patient only)
- `DELETE /medical-records/:id` - Delete medical record (Patient only)

#### Appointments (`/api/appointment`)
- `POST /` - Create appointment (Patient only)
- `GET /` - Get appointments (filtered by role)
- `GET /:id` - Get appointment by ID
- `PUT /:id` - Update appointment
- `POST /:id/accept` - Accept appointment (Doctor only)
- `POST /:id/reject` - Reject appointment (Doctor only)
- `POST /:id/cancel` - Cancel appointment (Patient only)

#### Chat (`/api/chat`)
- `POST /conversation` - Create/get conversation
- `POST /send` - Send message
- `GET /messages/:conversationId` - Get messages
- `GET /conversations` - List conversations (Admin/Doctor only)
- `GET /unread-count` - Get unread count (Admin/Doctor only)
- `PUT /conversations/:conversationId/read` - Mark as read

#### Video Sessions (`/api/video`)
- `POST /start` - Start video session
- `POST /end` - End video session
- `GET /by-appointment/:appointmentId` - Get session by appointment

#### Products (`/api/products`)
- `POST /` - Create product (Doctor/Pharmacy/Admin)
- `GET /` - List products (with filters)
- `GET /:id` - Get product by ID
- `PUT /:id` - Update product
- `DELETE /:id` - Delete product

#### Reviews (`/api/reviews`)
- `POST /` - Create review (Patient only)
- `GET /` - List reviews (with filters)
- `GET /:id` - Get review by ID
- `PUT /:id` - Update review (Patient only)
- `DELETE /:id` - Delete review (Patient only)

#### Subscriptions (`/api/subscription`)
- `GET /plans` - Get active subscription plans (Public)
- `GET /my-subscription` - Get current subscription (Doctor only)

#### Admin (`/api/admin`)
- `GET /dashboard` - Get admin dashboard
- `GET /doctors` - List doctors with filters
- `GET /reviews` - Get all reviews
- `GET /transactions` - Get all transactions
- `PUT /profile` - Update admin profile

#### Specializations (`/api/specialization`)
- `POST /` - Create specialization (Admin only)
- `GET /` - List all specializations (Public)
- `PUT /:id` - Update specialization (Admin only)
- `DELETE /:id` - Delete specialization (Admin only)

#### Subscription Plans (`/api/admin/subscription-plan`)
- `POST /` - Create plan (Admin only)
- `GET /` - Get all plans (Admin only)
- `GET /active` - Get active plans (Public)
- `GET /:id` - Get plan by ID (Admin only)
- `PUT /:id` - Update plan (Admin only)
- `DELETE /:id` - Delete plan (Admin only)

#### File Uploads (`/api/upload`)
- `POST /profile` - Upload profile image
- `POST /doctor-documents` - Upload doctor documents
- `POST /clinic` - Upload clinic images
- `POST /product` - Upload product images
- `POST /blog` - Upload blog images
- `POST /pharmacy` - Upload pharmacy images
- `POST /general` - Upload general files

#### Other Routes
- `/api/pharmacy` - Pharmacy management
- `/api/favorite` - Favorite doctors management
- `/api/blog` - Blog post management
- `/api/notification` - Notification management
- `/api/transaction` - Transaction management
- `/api/availability` - Doctor availability management
- `/api/payment` - Payment processing
- `/api/announcements` - System announcements

**Total: 100+ API endpoints**

---

## 🔐 Authentication

### Authentication Flow

1. **Registration:**
   - Patients: Auto-approved, can login immediately
   - Doctors: Status set to PENDING, requires admin approval

2. **Login:**
   - Validates email and password
   - Checks account status (blocks BLOCKED/REJECTED users)
   - Returns JWT token and user data

3. **Protected Routes:**
   - Include JWT token in `Authorization` header
   - Format: `Authorization: Bearer <token>`

4. **Role-Based Access:**
   - Routes protected with `authGuard([...roles])`
   - Validates token, checks user status, enforces role permissions

### User Roles

- **ADMIN**: Full platform access, user management, doctor approval
- **DOCTOR**: Profile management, appointment handling, product management (with subscription)
- **PATIENT**: Appointment booking, medical records, reviews

### Account Status

- **PENDING**: Awaiting admin approval (doctors only)
- **APPROVED**: Active account, can use platform
- **REJECTED**: Registration rejected, cannot login
- **BLOCKED**: Account blocked, cannot login

### Security Features

- Password hashing with bcrypt (10 salt rounds)
- JWT tokens with configurable expiration
- Refresh token support
- Account status validation
- Role-based access control
- Password never returned in API responses

---

## 🗄️ Key Modules

### Models (20+)

- **User**: Base user model with roles and authentication
- **DoctorProfile**: Doctor-specific information, specializations, clinics
- **Appointment**: Appointment booking and status management
- **MedicalRecord**: Patient medical records (prescriptions, lab reports, etc.)
- **SubscriptionPlan**: Subscription plan definitions
- **DoctorSubscription**: Individual doctor subscriptions
- **Product**: Products sold by doctors/pharmacies/admin
- **Pharmacy**: Pharmacy profiles and information
- **Review**: Patient reviews and ratings for doctors
- **Favorite**: Patient favorite doctors
- **BlogPost**: Health articles and blog content
- **ChatMessage**: Chat messages between users
- **Conversation**: Chat conversations
- **VideoSession**: Video consultation sessions
- **Notification**: System notifications
- **Transaction**: Payment transactions
- **Specialization**: Medical specializations
- **Announcement**: System announcements
- **DoctorAvailability**: Doctor availability schedules
- And more...

### Services (20+)

Business logic layer handling:
- Authentication and authorization
- User management
- Doctor profile management
- Appointment workflows
- Communication (chat/video)
- Medical records
- Product management
- Payment processing
- Subscription management
- Review and rating calculations
- And more...

### Controllers (20+)

HTTP request handlers that:
- Validate requests
- Call appropriate services
- Return standardized responses
- Handle errors

### Validators (16+)

Zod schemas for:
- Request validation
- Data type checking
- Business rule enforcement
- Input sanitization

---

## 📤 File Uploads

### Supported Upload Types

- **Profile Images**: User profile pictures
- **Doctor Documents**: Certificates, licenses, qualifications
- **Clinic Images**: Clinic photos
- **Product Images**: Product photos
- **Blog Images**: Blog post images
- **Pharmacy Images**: Pharmacy photos
- **Medical Records**: Prescriptions, lab reports, test results, images, PDFs
- **General Files**: Miscellaneous file uploads

### Upload Configuration

- **Storage**: `/uploads/<folder>/`
- **Max Size**: 5MB per file
- **Allowed Types**: JPEG, PNG, WebP
- **Access**: `http://localhost:PORT/uploads/<folder>/<filename>`

### Upload Endpoints

All upload endpoints use `POST` method:
- `/api/upload/profile`
- `/api/upload/doctor-documents`
- `/api/upload/clinic`
- `/api/upload/product`
- `/api/upload/blog`
- `/api/upload/pharmacy`
- `/api/upload/general`

---

## ⚙️ Environment Variables

### Required Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/mydoctore

# JWT
JWT_SECRET=your-super-secret-jwt-key
REFRESH_TOKEN_SECRET=your-refresh-token-secret
JWT_EXPIRE=7d
```

### Optional Variables

```env
# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## 📝 Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Pagination Response

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  }
}
```

---

## 🔑 Key Features Summary

✅ JWT authentication with role-based access control  
✅ Secure password hashing (bcrypt)  
✅ Patient auto-approval on registration  
✅ Doctor approval workflow  
✅ Appointment booking and management  
✅ Time-locked communication system  
✅ Medical records management  
✅ Subscription plan system  
✅ Product management (doctors/pharmacies/admin)  
✅ Review and rating system  
✅ Blog content management  
✅ File upload system  
✅ Dashboard for all user types  
✅ Payment transaction tracking  
✅ Notification system  
✅ Specialization management  
✅ Doctor availability scheduling  
✅ Double-booking prevention  
✅ Profile completion tracking  
✅ Zod validation for all requests  
✅ Comprehensive error handling  

---

## 📊 Statistics

- **Models**: 20+
- **Services**: 20+
- **Controllers**: 20+
- **Routes**: 20+
- **Validators**: 16+
- **Middleware**: 7
- **API Endpoints**: 100+
- **Total Files**: 150+

---

## 🧪 Testing

The project includes a `test.http` file with comprehensive API test cases. Use REST Client extension in VS Code or similar tools to test endpoints.

---

## 📄 License

ISC

---

## 🤝 Contributing

This is a private project. For questions or issues, please contact the development team.

---

**Built with ❤️ using Express.js, MongoDB, and modern Node.js practices**
