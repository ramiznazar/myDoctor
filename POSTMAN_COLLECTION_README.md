# MyDoctor Platform - Postman Collection Guide

## 📦 Collection File
**File:** `MyDoctor_Platform_Postman_Collection.json`

## 🚀 Quick Start

### 1. Import Collection
1. Open Postman
2. Click **Import** button
3. Select `MyDoctor_Platform_Postman_Collection.json`
4. Collection will be imported with all folders organized

### 2. Set Variables
After importing, set the following variables in the collection:

1. Click on collection name → **Variables** tab
2. Set the following:
   - `baseUrl`: `http://localhost:5000/api` (or your server URL)
   - `adminToken`: (Leave empty, will be set after login)
   - `doctorToken`: (Leave empty, will be set after login)
   - `patientToken`: (Leave empty, will be set after login)

### 3. Get Tokens
1. Use **"Login"** request in **"0. Common & Public"** folder
2. Copy the token from response
3. Paste it in the appropriate variable (`adminToken`, `doctorToken`, or `patientToken`)

## 📁 Collection Structure

### 0. Common & Public
- Health check
- Registration (Doctor/Patient)
- Login
- Public endpoints (doctors, products, specializations, etc.)

### 1. Admin Panel
Organized into subfolders:
- **Dashboard** - Statistics and overview
- **User Management** - Manage all users
- **Doctor Management** - Approve/manage doctors
- **Patient Management** - View patients
- **Appointment Management** - View all appointments
- **Subscription Plans** - CRUD operations
- **Specializations** - CRUD operations
- **Products** - Manage products
- **Pharmacies** - Manage pharmacies
- **Reviews** - View all reviews
- **Transactions** - View all transactions
- **Notifications** - Send notifications
- **Announcements** - Create/manage announcements
- **Chat** - Admin-Doctor chat
- **Blog** - Manage blog posts
- **System Activity** - View system logs

### 2. Doctor Panel
Organized into subfolders:
- **Profile Management** - Update profile
- **Dashboard** - Doctor statistics
- **Subscriptions** - Buy/view subscriptions
- **Availability** - Set/get availability
- **Appointments** - Manage appointments
- **Products** - Create/manage products (requires FULL subscription)
- **Chat** - Chat with admin and patients
- **Video Sessions** - Start/end video calls
- **Announcements** - View announcements
- **Blog** - Create blog posts
- **Notifications** - View notifications
- **Account** - Change password

### 3. Patient Panel
Organized into subfolders:
- **Dashboard** - Patient statistics
- **Profile** - Update profile
- **Appointments** - Book/manage appointments
- **Medical Records** - Manage medical records
- **Payments** - Process payments, view history
- **Reviews** - Review doctors
- **Favorites** - Manage favorite doctors
- **Chat** - Chat with doctors
- **Video Sessions** - Join video calls
- **Notifications** - View notifications
- **Account** - Change password

### 4. File Uploads
- Profile images
- Doctor documents
- Clinic images
- Product images
- Blog covers
- General images

## 🔑 Important Notes

### Authentication
- Most endpoints require JWT token
- Token is sent in `Authorization: Bearer <token>` header
- Tokens are automatically added via collection variables

### Replacing IDs
- Replace placeholders like `:id`, `:doctorId`, `:patientId` with actual IDs
- Or use Postman variables for dynamic values

### Common Placeholders
- `DOCTOR_ID_HERE` - Replace with actual doctor ID
- `PATIENT_ID_HERE` - Replace with actual patient ID
- `APPOINTMENT_ID_HERE` - Replace with actual appointment ID
- `CONVERSATION_ID_HERE` - Replace with actual conversation ID
- `ANNOUNCEMENT_ID_HERE` - Replace with actual announcement ID
- `PRODUCT_ID_HERE` - Replace with actual product ID
- `SPECIALIZATION_ID_HERE` - Replace with actual specialization ID
- `SUBSCRIPTION_PLAN_ID_HERE` - Replace with actual plan ID

## 📝 Testing Flow

### Recommended Order:
1. **Health Check** - Verify server is running
2. **Register Users** - Register admin, doctor, patient
3. **Login** - Get tokens for each user
4. **Set Tokens** - Update collection variables
5. **Admin Setup** - Create specializations, subscription plans
6. **Doctor Setup** - Complete profile, buy subscription
7. **Admin Approval** - Approve doctor
8. **Patient Actions** - Book appointments
9. **Doctor Actions** - Accept appointments
10. **Communication** - Test chat and video
11. **Other Features** - Products, reviews, etc.

## 🎯 Features Included

✅ **190+ API Endpoints**  
✅ **Organized by User Roles**  
✅ **Complete Request Examples**  
✅ **Variable Support**  
✅ **Proper Authentication Headers**  
✅ **Request Descriptions**  
✅ **All Routes from Codebase**  

## 🔧 Customization

### Adding Environment Variables
You can create Postman environments for:
- Development: `http://localhost:5000/api`
- Staging: `https://staging-api.example.com/api`
- Production: `https://api.example.com/api`

### Pre-request Scripts
You can add pre-request scripts to automatically:
- Set tokens from login responses
- Generate dynamic IDs
- Add timestamps

## 📊 Collection Statistics

- **Total Endpoints:** 190+
- **Folders:** 4 main folders with multiple subfolders
- **Variables:** 4 (baseUrl, adminToken, doctorToken, patientToken)
- **Coverage:** 100% of all routes in codebase

## 🆘 Troubleshooting

### Token Not Working
- Make sure token is set in collection variables
- Check token hasn't expired
- Verify token format: `Bearer <token>`

### 401 Unauthorized
- Check if token is set correctly
- Verify user role has permission for endpoint
- Make sure token is in Authorization header

### 404 Not Found
- Check baseUrl is correct
- Verify endpoint path matches route
- Ensure server is running

### Missing Endpoints
- All routes from codebase are included
- Check if endpoint is in correct folder
- Verify route exists in `src/routes/` directory

---

**Generated:** January 2024  
**Version:** 1.0.0  
**Compatible with:** Postman v9.0+






