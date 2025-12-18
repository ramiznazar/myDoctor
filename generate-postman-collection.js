const fs = require('fs');

// Postman Collection Structure
const collection = {
  info: {
    name: "MyDoctor Platform - Complete API Collection",
    description: "Complete API collection for MyDoctor Platform backend with all endpoints organized by Admin, Doctor, and Patient panels",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    _exporter_id: "mydoctor-platform"
  },
  variable: [
    {
      key: "baseUrl",
      value: "http://localhost:5000/api",
      type: "string"
    },
    {
      key: "adminToken",
      value: "",
      type: "string"
    },
    {
      key: "doctorToken",
      value: "",
      type: "string"
    },
    {
      key: "patientToken",
      value: "",
      type: "string"
    }
  ],
  item: []
};

// Helper function to create request
function createRequest(name, method, path, auth = null, body = null, description = "") {
  const request = {
    name: name,
    request: {
      method: method,
      header: [
        {
          key: "Content-Type",
          value: "application/json"
        }
      ],
      url: {
        raw: "{{baseUrl}}" + path,
        host: ["{{baseUrl}}"],
        path: path.split('/').filter(p => p)
      },
      description: description
    }
  };

  if (auth) {
    request.request.header.push({
      key: "Authorization",
      value: "Bearer {{" + auth + "Token}}"
    });
  }

  if (body) {
    request.request.body = {
      mode: "raw",
      raw: JSON.stringify(body, null, 2),
      options: {
        raw: {
          language: "json"
        }
      }
    };
  }

  return request;
}

// Helper function to create folder
function createFolder(name, items) {
  return {
    name: name,
    item: items
  };
}

// ========== COMMON/PUBLIC ENDPOINTS ==========
const commonEndpoints = [
  createRequest("Health Check", "GET", "/health", null, null, "Check if server is running"),
  createRequest("Register Doctor", "POST", "/auth/register", null, {
    "fullName": "Dr. John Doe",
    "email": "doctor@example.com",
    "password": "123456",
    "role": "DOCTOR",
    "phone": "1234567890",
    "gender": "MALE"
  }, "Register a new doctor (status: PENDING)"),
  createRequest("Register Patient", "POST", "/auth/register", null, {
    "fullName": "Jane Smith",
    "email": "patient@example.com",
    "password": "123456",
    "role": "PATIENT",
    "phone": "0987654321",
    "gender": "FEMALE"
  }, "Register a new patient (status: APPROVED)"),
  createRequest("Login", "POST", "/auth/login", null, {
    "email": "user@example.com",
    "password": "123456"
  }, "Login user and get JWT token"),
  createRequest("Refresh Token", "POST", "/auth/refresh-token", null, {
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }, "Refresh JWT access token"),
  createRequest("List Specializations", "GET", "/specialization", null, null, "Get all specializations (public)"),
  createRequest("List Doctors", "GET", "/doctor", null, null, "List all approved doctors (public)"),
  createRequest("Get Doctor Profile", "GET", "/doctor/profile/:id", null, null, "Get doctor profile by ID (public)"),
  createRequest("List Products", "GET", "/products", null, null, "List all products (public)"),
  createRequest("Get Product by ID", "GET", "/products/:id", null, null, "Get product details (public)"),
  createRequest("List Pharmacies", "GET", "/pharmacy", null, null, "List all pharmacies (public)"),
  createRequest("Get Pharmacy by ID", "GET", "/pharmacy/:id", null, null, "Get pharmacy details (public)"),
  createRequest("Get Doctor Reviews", "GET", "/reviews/doctor/:doctorId", null, null, "Get reviews for a doctor (public)"),
  createRequest("Get Doctor Reviews (Query)", "GET", "/reviews?doctorId=:doctorId&page=1&limit=10", null, null, "Get reviews for a doctor using query parameter (public)"),
  createRequest("List Blog Posts", "GET", "/blog", null, null, "List all published blog posts (public)"),
  createRequest("Get Blog Post by ID", "GET", "/blog/:id", null, null, "Get blog post details (public)"),
  createRequest("Get Available Time Slots", "GET", "/availability/slots?doctorId=:doctorId&date=:date", null, null, "Get available time slots for a doctor (public)"),
  createRequest("Check Time Slot Availability", "GET", "/availability/check?doctorId=:doctorId&date=:date&timeSlot=:timeSlot", null, null, "Check if a time slot is available (public)"),
  createRequest("Get Route", "GET", "/mapping/route?from[lat]=:lat&from[lng]=:lng&to[lat]=:lat&to[lng]=:lng", null, null, "Get route from patient to clinic (public)"),
  createRequest("Get Nearby Clinics", "GET", "/mapping/nearby?lat=:lat&lng=:lng&radius=:radius", null, null, "Get nearby clinics (public)"),
  createRequest("Get Clinic Location", "GET", "/mapping/clinic/:id", null, null, "Get clinic location by ID (public)"),
  createRequest("Get Active Subscription Plans", "GET", "/admin/subscription-plan/active", null, null, "Get all active subscription plans (public)")
];

// ========== ADMIN PANEL ENDPOINTS ==========
const adminDashboard = [
  createRequest("Get Dashboard Stats", "GET", "/admin/dashboard", "admin", null, "Get admin dashboard statistics")
];

const adminUserManagement = [
  createRequest("List All Users", "GET", "/users", "admin", null, "List all users with filtering"),
  createRequest("Get User by ID", "GET", "/users/:id", "admin", null, "Get user details by ID"),
  createRequest("Update User Profile", "PUT", "/users/profile", "admin", {
    "fullName": "Updated Name",
    "phone": "1234567890"
  }, "Update user profile"),
  createRequest("Update User Status", "PUT", "/users/status/:id", "admin", {
    "status": "APPROVED"
  }, "Update user status (APPROVED/REJECTED/BLOCKED)"),
  createRequest("Delete User", "DELETE", "/admin/users/:id", "admin", null, "Delete user"),
  createRequest("Update Admin Profile", "PUT", "/admin/profile", "admin", {
    "fullName": "Admin Name",
    "phone": "1234567890"
  }, "Update admin profile")
];

const adminDoctorManagement = [
  createRequest("List All Doctors", "GET", "/admin/doctors", "admin", null, "List all doctors with filtering"),
  createRequest("Get Doctors for Chat", "GET", "/admin/doctors/chat?search=:search&status=:status", "admin", null, "Get doctors list with unread message counts for chat"),
  createRequest("Approve Doctor", "POST", "/auth/approve-doctor", "admin", {
    "doctorId": "DOCTOR_ID_HERE"
  }, "Approve a pending doctor")
];

const adminPatientManagement = [
  createRequest("List All Patients", "GET", "/admin/patients", "admin", null, "List all patients")
];

const adminAppointmentManagement = [
  createRequest("List All Appointments", "GET", "/admin/appointments", "admin", null, "List all appointments"),
  createRequest("List Appointments by Doctor", "GET", "/admin/appointments?doctorId=:doctorId", "admin", null, "List appointments filtered by doctor")
];

const adminSubscriptionPlans = [
  createRequest("Create Subscription Plan (Admin Route)", "POST", "/admin/subscription-plan", "admin", {
    "name": "BASIC",
    "price": 50,
    "durationInDays": 30,
    "features": ["Basic profile", "Limited services"]
  }, "Create a new subscription plan"),
  createRequest("List All Subscription Plans (Admin Route)", "GET", "/admin/subscription-plan", "admin", null, "List all subscription plans"),
  createRequest("Get Subscription Plan by ID (Admin Route)", "GET", "/admin/subscription-plan/:id", "admin", null, "Get subscription plan details"),
  createRequest("Update Subscription Plan (Admin Route)", "PUT", "/admin/subscription-plan/:id", "admin", {
    "name": "BASIC",
    "price": 60,
    "durationInDays": 30
  }, "Update subscription plan"),
  createRequest("Delete Subscription Plan (Admin Route)", "DELETE", "/admin/subscription-plan/:id", "admin", null, "Delete subscription plan"),
  createRequest("Create Subscription Plan (Alternative Route)", "POST", "/subscription", "admin", {
    "name": "BASIC",
    "price": 50,
    "durationInDays": 30,
    "features": ["Basic profile"]
  }, "Create subscription plan (alternative route)"),
  createRequest("Update Subscription Plan (Alternative Route)", "PUT", "/subscription/:id", "admin", {
    "name": "BASIC",
    "price": 60
  }, "Update subscription plan (alternative route)"),
  createRequest("Assign Subscription to Doctor", "POST", "/subscription/assign", "admin", {
    "doctorId": "DOCTOR_ID_HERE",
    "planId": "PLAN_ID_HERE"
  }, "Assign subscription to doctor"),
  createRequest("List Subscription Plans (Public)", "GET", "/subscription", null, null, "List all subscription plans (public)")
];

const adminSpecializations = [
  createRequest("Create Specialization", "POST", "/specialization", "admin", {
    "name": "Cardiology",
    "slug": "cardiology",
    "description": "Heart and cardiovascular system",
    "icon": "heart-icon.png"
  }, "Create a new specialization"),
  createRequest("Update Specialization", "PUT", "/specialization/:id", "admin", {
    "name": "Updated Cardiology",
    "description": "Updated description"
  }, "Update specialization"),
  createRequest("Delete Specialization", "DELETE", "/specialization/:id", "admin", null, "Delete specialization"),
  createRequest("Get All Specializations (Admin)", "GET", "/admin/specializations", "admin", null, "Get all specializations (admin view)")
];

const adminProducts = [
  createRequest("List All Products", "GET", "/admin/products", "admin", null, "List all products (admin view)"),
  createRequest("Create Product (Admin)", "POST", "/products", "admin", {
    "name": "Premium Health Package",
    "description": "Comprehensive health checkup",
    "price": 299.99,
    "discountPrice": 249.99,
    "stock": 50,
    "category": "Health Packages"
  }, "Create product as admin (website product)"),
  createRequest("Update Product (Admin)", "PUT", "/products/:id", "admin", {
    "price": 279.99,
    "stock": 75
  }, "Update any product (admin can update any product)"),
  createRequest("Delete Product (Admin)", "DELETE", "/products/:id", "admin", null, "Delete any product (admin can delete any product)")
];

const adminPharmacies = [
  createRequest("List All Pharmacies", "GET", "/admin/pharmacies", "admin", null, "List all pharmacies (admin view)"),
  createRequest("Create Pharmacy", "POST", "/pharmacy", "admin", {
    "name": "City Pharmacy",
    "address": {
      "line1": "456 Pharmacy Street",
      "city": "New York",
      "state": "NY",
      "country": "USA",
      "zip": "10001"
    },
    "phone": "1234567890"
  }, "Create a new pharmacy"),
  createRequest("Update Pharmacy", "PUT", "/pharmacy/:id", "admin", {
    "name": "Updated Pharmacy Name"
  }, "Update pharmacy"),
  createRequest("Delete Pharmacy", "DELETE", "/pharmacy/:id", "admin", null, "Delete pharmacy")
];

const adminReviews = [
  createRequest("List All Reviews", "GET", "/admin/reviews", "admin", null, "List all reviews (admin view)")
];

const adminTransactions = [
  createRequest("List All Transactions", "GET", "/admin/transactions", "admin", null, "List all payment transactions"),
  createRequest("List Transactions (Transaction Route)", "GET", "/transaction", "admin", null, "List all transactions with filtering"),
  createRequest("Get Transaction by ID", "GET", "/transaction/:id", "admin", null, "Get transaction details"),
  createRequest("Update Transaction Status", "PUT", "/transaction/:id", "admin", {
    "status": "SUCCESS"
  }, "Update transaction status"),
  createRequest("Create Transaction", "POST", "/transaction", "admin", {
    "userId": "USER_ID_HERE",
    "amount": 100,
    "type": "APPOINTMENT",
    "status": "PENDING"
  }, "Create a transaction"),
  createRequest("Refund Transaction", "POST", "/payment/refund/:id", "admin", null, "Refund a transaction")
];

const adminNotifications = [
  createRequest("Send Notification", "POST", "/notification", "admin", {
    "userId": "USER_ID_HERE",
    "title": "Notification Title",
    "body": "Notification message",
    "type": "SYSTEM"
  }, "Send notification to a user")
];

const adminAnnouncements = [
  createRequest("Create Broadcast Announcement", "POST", "/announcements", "admin", {
    "title": "Platform Maintenance",
    "message": "System will be down on Jan 15",
    "announcementType": "BROADCAST",
    "priority": "IMPORTANT",
    "isPinned": true,
    "expiryType": "EXPIRE_AFTER_DATE",
    "expiryDate": "2024-01-20T00:00:00.000Z"
  }, "Create broadcast announcement (all doctors)"),
  createRequest("Create Targeted Announcement", "POST", "/announcements", "admin", {
    "title": "New Guidelines",
    "message": "Please review new guidelines",
    "announcementType": "TARGETED",
    "priority": "URGENT",
    "targetCriteria": {
      "specializationIds": ["SPEC_ID_HERE"]
    }
  }, "Create targeted announcement"),
  createRequest("List All Announcements", "GET", "/announcements", "admin", null, "List all announcements"),
  createRequest("Get Announcement by ID", "GET", "/announcements/:id", "admin", null, "Get announcement details"),
  createRequest("Update Announcement", "PUT", "/announcements/:id", "admin", {
    "title": "Updated Title",
    "priority": "URGENT"
  }, "Update announcement"),
  createRequest("Delete Announcement", "DELETE", "/announcements/:id", "admin", null, "Delete announcement"),
  createRequest("Get Announcement Read Status", "GET", "/announcements/:id/read-status", "admin", null, "Get who has read the announcement")
];

const adminChat = [
  createRequest("Get All Conversations", "GET", "/chat/conversations", "admin", null, "Get all admin-doctor conversations"),
  createRequest("Get Unread Message Count", "GET", "/chat/unread-count", "admin", null, "Get unread message count"),
  createRequest("Start Conversation with Doctor", "POST", "/chat/conversation", "admin", {
    "adminId": "ADMIN_ID_HERE",
    "doctorId": "DOCTOR_ID_HERE"
  }, "Start conversation with doctor"),
  createRequest("Send Message to Doctor", "POST", "/chat/send", "admin", {
    "adminId": "ADMIN_ID_HERE",
    "doctorId": "DOCTOR_ID_HERE",
    "message": "Hello Doctor"
  }, "Send message to doctor"),
  createRequest("Get Messages", "GET", "/chat/messages/:conversationId", "admin", null, "Get messages for conversation"),
  createRequest("Mark Messages as Read", "PUT", "/chat/conversations/:conversationId/read", "admin", null, "Mark messages as read")
];

const adminBlog = [
  createRequest("Create Blog Post", "POST", "/blog", "admin", {
    "title": "Blog Title",
    "content": "Blog content here",
    "isPublished": true
  }, "Create blog post"),
  createRequest("Update Blog Post", "PUT", "/blog/:id", "admin", {
    "title": "Updated Title"
  }, "Update blog post"),
  createRequest("Delete Blog Post", "DELETE", "/blog/:id", "admin", null, "Delete blog post")
];

const adminActivity = [
  createRequest("Get System Activity", "GET", "/admin/activity", "admin", null, "Get system activity logs")
];

// ========== DOCTOR PANEL ENDPOINTS ==========
const doctorProfile = [
  createRequest("Update Profile", "PUT", "/doctor/profile", "doctor", {
    "title": "Senior Cardiologist",
    "biography": "Experienced doctor",
    "specializationId": "SPEC_ID_HERE",
    "experienceYears": 15
  }, "Create or update doctor profile"),
  createRequest("Get My Profile", "GET", "/doctor/profile/:id", "doctor", null, "Get own profile")
];

const doctorDashboard = [
  createRequest("Get Dashboard", "GET", "/doctor/dashboard", "doctor", null, "Get doctor dashboard statistics"),
  createRequest("Get My Reviews", "GET", "/doctor/reviews", "doctor", null, "Get doctor's reviews")
];

const doctorSubscriptions = [
  createRequest("Buy Subscription Plan", "POST", "/doctor/buy-subscription", "doctor", {
    "planId": "PLAN_ID_HERE"
  }, "Purchase a subscription plan"),
  createRequest("Get My Subscription", "GET", "/doctor/my-subscription", "doctor", null, "Get current subscription plan")
];

const doctorAvailability = [
  createRequest("Set Availability", "POST", "/availability", "doctor", {
    "date": "2024-02-15",
    "timeSlots": [
      {
        "startTime": "09:00",
        "endTime": "10:00",
        "isAvailable": true
      }
    ]
  }, "Set doctor availability"),
  createRequest("Get Availability", "GET", "/availability?fromDate=:fromDate&toDate=:toDate", "doctor", null, "Get doctor availability")
];

const doctorWeeklySchedule = [
  createRequest("Create/Update Weekly Schedule", "POST", "/weekly-schedule", "doctor", {
    "dayOfWeek": "Monday",
    "timeSlots": [
      {
        "startTime": "09:00",
        "endTime": "17:00",
        "isAvailable": true
      }
    ]
  }, "Create or update weekly schedule"),
  createRequest("Get Weekly Schedule", "GET", "/weekly-schedule", "doctor", null, "Get weekly schedule"),
  createRequest("Update Appointment Duration", "PUT", "/weekly-schedule/duration", "doctor", {
    "duration": 30
  }, "Update appointment duration"),
  createRequest("Add Time Slot to Day", "POST", "/weekly-schedule/day/:dayOfWeek/slot", "doctor", {
    "startTime": "10:00",
    "endTime": "11:00",
    "isAvailable": true
  }, "Add time slot to a specific day"),
  createRequest("Update Time Slot", "PUT", "/weekly-schedule/day/:dayOfWeek/slot/:slotId", "doctor", {
    "startTime": "10:00",
    "endTime": "11:00",
    "isAvailable": false
  }, "Update time slot"),
  createRequest("Delete Time Slot", "DELETE", "/weekly-schedule/day/:dayOfWeek/slot/:slotId", "doctor", null, "Delete time slot"),
  createRequest("Get Available Slots for Date", "GET", "/weekly-schedule/slots?doctorId=:doctorId&date=:date", null, null, "Get available slots for a date (public)")
];

const doctorAppointments = [
  createRequest("List My Appointments", "GET", "/appointment?doctorId=:doctorId", "doctor", null, "List doctor's appointments"),
  createRequest("Get Appointment by ID", "GET", "/appointment/:id", "doctor", null, "Get appointment details"),
  createRequest("Accept Appointment", "POST", "/appointment/:id/accept", "doctor", null, "Accept appointment request"),
  createRequest("Reject Appointment", "POST", "/appointment/:id/reject", "doctor", {
    "reason": "Time slot not available"
  }, "Reject appointment request"),
  createRequest("Update Appointment Status", "PUT", "/appointment/:id/status", "doctor", {
    "status": "COMPLETED",
    "notes": "Consultation completed"
  }, "Update appointment status")
];

const doctorProducts = [
  createRequest("Create Product", "POST", "/products", "doctor", {
    "name": "Vitamin D Supplements",
    "description": "High quality supplements",
    "price": 25.99,
    "discountPrice": 19.99,
    "stock": 100,
    "category": "Supplements"
  }, "Create product (requires FULL subscription)"),
  createRequest("Update Product", "PUT", "/products/:id", "doctor", {
    "price": 29.99,
    "stock": 150
  }, "Update own product"),
  createRequest("Delete Product", "DELETE", "/products/:id", "doctor", null, "Delete own product")
];

const doctorChat = [
  createRequest("Get All Conversations", "GET", "/chat/conversations", "doctor", null, "Get all conversations (admin-doctor + doctor-patient)"),
  createRequest("Get Unread Message Count", "GET", "/chat/unread-count", "doctor", null, "Get unread message count"),
  createRequest("Start Conversation with Admin", "POST", "/chat/conversation", "doctor", {
    "adminId": "ADMIN_ID_HERE",
    "doctorId": "DOCTOR_ID_HERE"
  }, "Start conversation with admin"),
  createRequest("Send Message to Admin", "POST", "/chat/send", "doctor", {
    "adminId": "ADMIN_ID_HERE",
    "doctorId": "DOCTOR_ID_HERE",
    "message": "Hello Admin"
  }, "Send message to admin"),
  createRequest("Start Conversation with Patient", "POST", "/chat/conversation", "doctor", {
    "doctorId": "DOCTOR_ID_HERE",
    "patientId": "PATIENT_ID_HERE",
    "appointmentId": "APPOINTMENT_ID_HERE"
  }, "Start conversation with patient (requires CONFIRMED appointment)"),
  createRequest("Send Message to Patient", "POST", "/chat/send", "doctor", {
    "doctorId": "DOCTOR_ID_HERE",
    "patientId": "PATIENT_ID_HERE",
    "appointmentId": "APPOINTMENT_ID_HERE",
    "message": "Hello Patient"
  }, "Send message to patient"),
  createRequest("Get Messages", "GET", "/chat/messages/:conversationId", "doctor", null, "Get messages for conversation"),
  createRequest("Mark Messages as Read", "PUT", "/chat/conversations/:conversationId/read", "doctor", null, "Mark messages as read")
];

const doctorVideoSessions = [
  createRequest("Start Video Session", "POST", "/video/start", "doctor", {
    "appointmentId": "APPOINTMENT_ID_HERE"
  }, "Start video session (requires CONFIRMED ONLINE appointment)"),
  createRequest("End Video Session", "POST", "/video/end", "doctor", {
    "sessionId": "SESSION_ID_HERE"
  }, "End video session"),
  createRequest("Get Session by Appointment", "GET", "/video/by-appointment/:appointmentId", "doctor", null, "Get video session by appointment ID")
];

const doctorAnnouncements = [
  createRequest("Get My Announcements", "GET", "/announcements/doctor", "doctor", null, "Get announcements for doctor"),
  createRequest("Get Unread Announcement Count", "GET", "/announcements/unread-count", "doctor", null, "Get unread announcement count"),
  createRequest("Get Announcement by ID", "GET", "/announcements/:id", "doctor", null, "Get announcement details"),
  createRequest("Mark Announcement as Read", "POST", "/announcements/:id/read", "doctor", null, "Mark announcement as read")
];

const doctorBlog = [
  createRequest("Create Blog Post", "POST", "/blog", "doctor", {
    "title": "Health Tips",
    "content": "Blog content",
    "isPublished": true
  }, "Create blog post"),
  createRequest("Update Blog Post", "PUT", "/blog/:id", "doctor", {
    "title": "Updated Title"
  }, "Update own blog post"),
  createRequest("Delete Blog Post", "DELETE", "/blog/:id", "doctor", null, "Delete own blog post")
];

const doctorNotifications = [
  createRequest("Get My Notifications", "GET", "/notification/:userId?isRead=false&page=1&limit=20", "doctor", null, "Get doctor's notifications (replace :userId with actual user ID)"),
  createRequest("Mark Notification as Read", "PUT", "/notification/read/:id", "doctor", null, "Mark notification as read")
];

const doctorChangePassword = [
  createRequest("Change Password", "POST", "/auth/change-password", "doctor", {
    "oldPassword": "123456",
    "newPassword": "newpassword123"
  }, "Change password")
];

// ========== PATIENT PANEL ENDPOINTS ==========
const patientDashboard = [
  createRequest("Get Dashboard", "GET", "/patient/dashboard", "patient", null, "Get patient dashboard statistics"),
  createRequest("Get Appointment History", "GET", "/patient/appointments/history", "patient", null, "Get appointment history"),
  createRequest("Get Payment History", "GET", "/patient/payments/history", "patient", null, "Get payment history")
];

const patientProfile = [
  createRequest("Update Profile", "PUT", "/users/profile", "patient", {
    "fullName": "Updated Name",
    "phone": "1234567890",
    "gender": "FEMALE"
  }, "Update patient profile"),
  createRequest("Get User by ID", "GET", "/users/:id", "patient", null, "Get user details")
];

const patientAppointments = [
  createRequest("Create Appointment", "POST", "/appointment", "patient", {
    "doctorId": "DOCTOR_ID_HERE",
    "patientId": "PATIENT_ID_HERE",
    "appointmentDate": "2024-02-15",
    "appointmentTime": "10:00",
    "bookingType": "VISIT",
    "patientNotes": "Regular checkup"
  }, "Create appointment request"),
  createRequest("List My Appointments", "GET", "/appointment?patientId=:patientId", "patient", null, "List patient's appointments"),
  createRequest("Get Appointment by ID", "GET", "/appointment/:id", "patient", null, "Get appointment details"),
  createRequest("Cancel Appointment", "POST", "/appointment/:id/cancel", "patient", {
    "reason": "Unable to attend"
  }, "Cancel appointment")
];

const patientMedicalRecords = [
  createRequest("Create Medical Record", "POST", "/patient/medical-records", "patient", {
    "title": "Blood Test Report",
    "description": "Complete blood count",
    "recordType": "LAB_REPORT",
    "fileUrl": "https://example.com/report.pdf"
  }, "Create medical record"),
  createRequest("Get Medical Records", "GET", "/patient/medical-records", "patient", null, "Get patient's medical records"),
  createRequest("Delete Medical Record", "DELETE", "/patient/medical-records/:id", "patient", null, "Delete medical record")
];

const patientPayments = [
  createRequest("Process Appointment Payment", "POST", "/payment/appointment", "patient", {
    "appointmentId": "APPOINTMENT_ID_HERE",
    "amount": 500,
    "paymentMethod": "DUMMY"
  }, "Process appointment payment"),
  createRequest("Process Product Payment", "POST", "/payment/product", "patient", {
    "productId": "PRODUCT_ID_HERE",
    "amount": 50,
    "paymentMethod": "DUMMY"
  }, "Process product payment"),
  createRequest("Get My Transactions", "GET", "/payment/transactions", "patient", null, "Get patient's transactions"),
  createRequest("Get Transaction by ID (Payment Route)", "GET", "/payment/transaction/:id", "patient", null, "Get transaction details"),
  createRequest("Get Transaction by ID (Transaction Route)", "GET", "/transaction/:id", "patient", null, "Get transaction details (alternative route)"),
  createRequest("Create Transaction", "POST", "/transaction", "patient", {
    "amount": 100,
    "type": "APPOINTMENT",
    "status": "PENDING"
  }, "Create a transaction")
];

const patientReviews = [
  createRequest("Create Review", "POST", "/reviews", "patient", {
    "doctorId": "DOCTOR_ID_HERE",
    "rating": 5,
    "reviewText": "Excellent doctor"
  }, "Create review for doctor (after completed appointment)"),
  createRequest("Delete Review", "DELETE", "/reviews/:id", "patient", null, "Delete own review")
];

const patientFavorites = [
  createRequest("Add Favorite Doctor", "POST", "/favorite", "patient", {
    "doctorId": "DOCTOR_ID_HERE"
  }, "Add doctor to favorites"),
  createRequest("Get Favorite Doctors", "GET", "/favorite/:patientId", "patient", null, "Get favorite doctors (replace :patientId with actual patient ID)"),
  createRequest("Remove Favorite", "DELETE", "/favorite/:id", "patient", null, "Remove favorite doctor (replace :id with favorite record ID)")
];

const patientChat = [
  createRequest("Start Conversation with Doctor", "POST", "/chat/conversation", "patient", {
    "doctorId": "DOCTOR_ID_HERE",
    "patientId": "PATIENT_ID_HERE",
    "appointmentId": "APPOINTMENT_ID_HERE"
  }, "Start conversation (requires CONFIRMED appointment)"),
  createRequest("Send Message to Doctor", "POST", "/chat/send", "patient", {
    "doctorId": "DOCTOR_ID_HERE",
    "patientId": "PATIENT_ID_HERE",
    "appointmentId": "APPOINTMENT_ID_HERE",
    "message": "Hello Doctor"
  }, "Send message (requires CONFIRMED appointment)"),
  createRequest("Get Messages", "GET", "/chat/messages/:conversationId", "patient", null, "Get messages for conversation")
];

const patientVideoSessions = [
  createRequest("Start Video Session", "POST", "/video/start", "patient", {
    "appointmentId": "APPOINTMENT_ID_HERE"
  }, "Start video session (requires CONFIRMED ONLINE appointment)"),
  createRequest("Get Session by Appointment", "GET", "/video/by-appointment/:appointmentId", "patient", null, "Get video session by appointment ID")
];

const patientNotifications = [
  createRequest("Get My Notifications", "GET", "/notification/:userId?isRead=false&page=1&limit=20", "patient", null, "Get patient's notifications (replace :userId with actual user ID)"),
  createRequest("Mark Notification as Read", "PUT", "/notification/read/:id", "patient", null, "Mark notification as read")
];

const patientChangePassword = [
  createRequest("Change Password", "POST", "/auth/change-password", "patient", {
    "oldPassword": "123456",
    "newPassword": "newpassword123"
  }, "Change password")
];

// ========== FILE UPLOADS ==========
const uploads = [
  createRequest("Upload Profile Image", "POST", "/upload/profile", "admin", null, "Upload profile image (multipart/form-data)"),
  createRequest("Upload Doctor Documents", "POST", "/upload/doctor-docs", "doctor", null, "Upload doctor documents"),
  createRequest("Upload Clinic Images", "POST", "/upload/clinic", "doctor", null, "Upload clinic images"),
  createRequest("Upload Product Images", "POST", "/upload/product", "doctor", null, "Upload product images"),
  createRequest("Upload Blog Cover", "POST", "/upload/blog", "doctor", null, "Upload blog cover image"),
  createRequest("Upload General Image", "POST", "/upload/general", "patient", null, "Upload general image")
];

// ========== ASSEMBLE COLLECTION ==========
collection.item = [
  createFolder("0. Common & Public", commonEndpoints),
  createFolder("1. Admin Panel", [
    createFolder("Dashboard", adminDashboard),
    createFolder("User Management", adminUserManagement),
    createFolder("Doctor Management", adminDoctorManagement),
    createFolder("Patient Management", adminPatientManagement),
    createFolder("Appointment Management", adminAppointmentManagement),
    createFolder("Subscription Plans", adminSubscriptionPlans),
    createFolder("Specializations", adminSpecializations),
    createFolder("Products", adminProducts),
    createFolder("Pharmacies", adminPharmacies),
    createFolder("Reviews", adminReviews),
    createFolder("Transactions", adminTransactions),
    createFolder("Notifications", adminNotifications),
    createFolder("Announcements", adminAnnouncements),
    createFolder("Chat", adminChat),
    createFolder("Blog", adminBlog),
    createFolder("System Activity", adminActivity)
  ]),
  createFolder("2. Doctor Panel", [
    createFolder("Profile Management", doctorProfile),
    createFolder("Dashboard", doctorDashboard),
    createFolder("Subscriptions", doctorSubscriptions),
    createFolder("Availability", doctorAvailability),
  createFolder("Weekly Schedule", doctorWeeklySchedule),
    createFolder("Appointments", doctorAppointments),
    createFolder("Products", doctorProducts),
    createFolder("Chat", doctorChat),
    createFolder("Video Sessions", doctorVideoSessions),
    createFolder("Announcements", doctorAnnouncements),
    createFolder("Blog", doctorBlog),
    createFolder("Notifications", doctorNotifications),
    createFolder("Account", doctorChangePassword)
  ]),
  createFolder("3. Patient Panel", [
    createFolder("Dashboard", patientDashboard),
    createFolder("Profile", patientProfile),
    createFolder("Appointments", patientAppointments),
    createFolder("Medical Records", patientMedicalRecords),
    createFolder("Payments", patientPayments),
    createFolder("Reviews", patientReviews),
    createFolder("Favorites", patientFavorites),
    createFolder("Chat", patientChat),
    createFolder("Video Sessions", patientVideoSessions),
    createFolder("Notifications", patientNotifications),
    createFolder("Account", patientChangePassword)
  ]),
  createFolder("4. File Uploads", uploads)
];

// Write to file
fs.writeFileSync('MyDoctor_Platform_Postman_Collection.json', JSON.stringify(collection, null, 2));
console.log('Postman collection generated successfully!');
console.log('File: MyDoctor_Platform_Postman_Collection.json');

