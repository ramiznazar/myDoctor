# MyDoctor Backend - Local Setup Guide

## ✅ What's Already Done

1. ✅ Dependencies installed (`node_modules` exists)
2. ✅ `.env` file created with required configuration
3. ✅ MongoDB installed on your system

## 🚀 Next Steps to Run the Application

### Step 1: Start MongoDB

Since you've installed MongoDB, you need to start the MongoDB service. Choose one of these methods:

#### Option A: Start MongoDB as a Windows Service (Recommended)
```powershell
# Start MongoDB service
Start-Service MongoDB

# Check if it's running
Get-Service MongoDB
```

#### Option B: Start MongoDB Manually
If MongoDB is not installed as a service, start it manually:
```powershell
# Navigate to MongoDB bin directory (usually in Program Files)
cd "C:\Program Files\MongoDB\Server\<version>\bin"

# Start MongoDB
.\mongod.exe --dbpath "C:\data\db"
```

**Note:** Make sure the data directory exists:
```powershell
# Create data directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "C:\data\db"
```

#### Option C: Using MongoDB Compass
If you installed MongoDB Compass, you can start MongoDB from there, or it may start automatically.

### Step 2: Verify MongoDB is Running

Test if MongoDB is accessible:
```powershell
# Test connection (this will fail if MongoDB is not running)
try {
    $connection = New-Object System.Net.Sockets.TcpClient("localhost", 27017)
    $connection.Close()
    Write-Host "✅ MongoDB is running on port 27017"
} catch {
    Write-Host "❌ MongoDB is not running. Please start it first."
}
```

Or use MongoDB shell:
```powershell
mongosh
# or
mongo
```

### Step 3: Update JWT Secrets (Important!)

**⚠️ SECURITY WARNING:** The `.env` file contains default JWT secrets. For security, change them:

1. Open `.env` file
2. Change these values to random secure strings:
   ```
   JWT_SECRET=your-random-secure-string-here
   REFRESH_TOKEN_SECRET=another-random-secure-string-here
   ```

You can generate secure secrets using:
```powershell
# Generate random secret
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Step 4: Create Upload Directories (Optional)

The application will create these automatically, but you can create them manually:
```powershell
cd e:\myDoctor
New-Item -ItemType Directory -Force -Path "uploads\profile"
New-Item -ItemType Directory -Force -Path "uploads\doctor-documents"
New-Item -ItemType Directory -Force -Path "uploads\clinic"
New-Item -ItemType Directory -Force -Path "uploads\product"
New-Item -ItemType Directory -Force -Path "uploads\blog"
New-Item -ItemType Directory -Force -Path "uploads\pharmacy"
New-Item -ItemType Directory -Force -Path "uploads\general"
```

### Step 5: Start the Application

#### Development Mode (with auto-reload):
```powershell
npm run dev
```

#### Production Mode:
```powershell
npm start
```

**Or use the helper script:**
```powershell
.\start-server.ps1
```
This script will check if port 5000 is free before starting.

### Step 6: Verify the Application is Running

Once started, you should see:
```
✓ MongoDB Connected: localhost:27017
MyDoctor API running on port 5000
```

Test the API:
```powershell
# Health check
Invoke-WebRequest -Uri "http://localhost:5000/" -Method GET
```

Or open in browser: `http://localhost:5000/`

You should see:
```json
{
  "success": true,
  "message": "MyDoctor API is running"
}
```

## 🔧 Troubleshooting

### MongoDB Connection Issues

**Error: "MongoDB connection error"**

1. **Check if MongoDB is running:**
   ```powershell
   Get-Service MongoDB
   # or
   Test-NetConnection -ComputerName localhost -Port 27017
   ```

2. **Check MongoDB connection string in `.env`:**
   ```
   MONGO_URI=mongodb://localhost:27017/mydoctore
   ```
   Make sure the port (27017) matches your MongoDB installation.

3. **Try connecting with MongoDB shell:**
   ```powershell
   mongosh mongodb://localhost:27017
   ```

### Port Already in Use

**Error: "Port 5000 is already in use" or "EADDRINUSE: address already in use :::5000"**

This happens when you try to start the server while it's already running. You have two options:

**Option 1: Stop the existing server (Easiest)**

Use the provided script:
```powershell
.\stop-server.ps1
```

Or manually:
```powershell
# Find the process using port 5000
$process = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($process) {
    Stop-Process -Id $process -Force
    Write-Host "Server stopped"
}
```

**Option 2: Use a different port**
Change the port in `.env`:
```
PORT=3000
```
Then restart the server.

### File Upload Issues

**Error when uploading files:**

1. **Authentication Required:**
   - All upload endpoints require authentication
   - You must include a JWT token in the request header:
     ```
     Authorization: Bearer <your-jwt-token>
     ```
   - First, login or register to get a token

2. **Invalid File Type:**
   - Only image files are allowed: JPEG, JPG, PNG, WebP
   - Error: "Invalid file type. Only JPEG, PNG, and WebP images are allowed."

3. **File Too Large:**
   - Maximum file size is 5MB per file
   - Error: "File size must be less than 5MB"

4. **Missing File:**
   - Make sure you're sending the file with the correct field name:
     - Single file: field name must be `file`
     - Multiple files: field name must be `files`
   - Error: "No file uploaded" or "Please select a file to upload"

5. **Upload Endpoints:**
   - `/api/upload/profile` - Single file (requires: ADMIN, DOCTOR, PATIENT)
   - `/api/upload/doctor-docs` - Multiple files (requires: DOCTOR)
   - `/api/upload/clinic` - Multiple files (requires: DOCTOR)
   - `/api/upload/product` - Multiple files (requires: DOCTOR, PHARMACY)
   - `/api/upload/blog` - Single file (requires: ADMIN, DOCTOR)
   - `/api/upload/pharmacy` - Single file (requires: PHARMACY, ADMIN)
   - `/api/upload/general` - Single file (requires: ADMIN, DOCTOR, PATIENT)

6. **Example Upload Request (using curl or Postman):**
   ```
   POST http://localhost:5000/api/upload/profile
   Headers:
     Authorization: Bearer <your-jwt-token>
     Content-Type: multipart/form-data
   Body (form-data):
     file: [select your image file]
   ```

### Missing Environment Variables

**Error: "Missing required environment variable"**

Make sure `.env` file exists and contains:
- `MONGO_URI`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `PORT`

### Node Modules Issues

If you encounter module errors:
```powershell
# Remove and reinstall dependencies
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

## 📝 Environment Variables Reference

### Required Variables
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `REFRESH_TOKEN_SECRET` - Secret key for refresh tokens
- `PORT` - Server port (default: 5000)

### Optional Variables
- `NODE_ENV` - Environment (development/production)
- `REDIS_HOST` - Redis host (for BullMQ queues)
- `REDIS_PORT` - Redis port (default: 6379)
- Upload paths, email, payment, and video configs (see `.env` file)

## 🎯 Quick Start Commands

```powershell
# 1. Start MongoDB
Start-Service MongoDB

# 2. Verify MongoDB
Test-NetConnection -ComputerName localhost -Port 27017

# 3. Start the application
npm run dev

# 4. Test the API
Invoke-WebRequest -Uri "http://localhost:5000/" -Method GET
```

## 📚 Additional Resources

- **API Documentation**: See `README.md` for full API documentation
- **Postman Collection**: `MyDoctor_Platform_Postman_Collection.json`
- **Test File**: `test.http` for API testing

## ✅ Success Checklist

- [ ] MongoDB is running on port 27017
- [ ] `.env` file exists with all required variables
- [ ] JWT secrets are changed from defaults
- [ ] Dependencies are installed (`npm install` completed)
- [ ] Application starts without errors
- [ ] Health check endpoint returns success

---

**Need Help?** Check the main `README.md` file for detailed API documentation and project structure.
