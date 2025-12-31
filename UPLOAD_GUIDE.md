# File Upload Guide - MyDoctor Backend

## ✅ Upload Directories Created

All required upload directories have been created:
- `uploads/profile/`
- `uploads/doctor-documents/`
- `uploads/clinic/`
- `uploads/product/`
- `uploads/blog/`
- `uploads/pharmacy/`
- `uploads/general/`

## 🔐 Authentication Required

**IMPORTANT:** All upload endpoints require authentication. You must:
1. First register/login to get a JWT token
2. Include the token in the `Authorization` header

## 📤 Upload Endpoints

### 1. Profile Image Upload
```
POST /api/upload/profile
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: file (single image)
Access: ADMIN, DOCTOR, PATIENT
```

### 2. Doctor Documents Upload
```
POST /api/upload/doctor-docs
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: files (multiple images, max 5)
Access: DOCTOR only
```

### 3. Clinic Images Upload
```
POST /api/upload/clinic
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: files (multiple images, max 10)
Access: DOCTOR only
```

### 4. Product Images Upload
```
POST /api/upload/product
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: files (multiple images, max 10)
Access: DOCTOR, PHARMACY
```

### 5. Blog Cover Image Upload
```
POST /api/upload/blog
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: file (single image)
Access: ADMIN, DOCTOR
```

### 6. Pharmacy Logo Upload
```
POST /api/upload/pharmacy
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: file (single image)
Access: PHARMACY, ADMIN
```

### 7. General File Upload
```
POST /api/upload/general
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: file (single image)
Access: ADMIN, DOCTOR, PATIENT
```

## 📋 File Requirements

- **Allowed Types:** JPEG, JPG, PNG, WebP only
- **Max File Size:** 5MB per file
- **Field Names:**
  - Single file uploads: use field name `file`
  - Multiple file uploads: use field name `files`

## 🧪 Testing Uploads

### Using PowerShell (Invoke-WebRequest)
```powershell
# First, login to get token
$loginBody = @{
    email = "your-email@example.com"
    password = "your-password"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginBody

$token = $loginResponse.data.token

# Upload a file
$filePath = "C:\path\to\your\image.jpg"
$form = @{
    file = Get-Item -Path $filePath
}

Invoke-RestMethod -Uri "http://localhost:5000/api/upload/profile" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $token" } `
    -Form $form
```

### Using Postman
1. Set method to `POST`
2. Enter URL: `http://localhost:5000/api/upload/profile`
3. Go to **Headers** tab:
   - Add: `Authorization: Bearer <your-token>`
4. Go to **Body** tab:
   - Select `form-data`
   - Add key `file` (type: File)
   - Select your image file
5. Click **Send**

### Using cURL
```bash
curl -X POST http://localhost:5000/api/upload/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/your/image.jpg"
```

## ❌ Common Errors & Solutions

### Error: "No file uploaded"
**Solution:** Make sure you're using the correct field name:
- Single upload: `file`
- Multiple upload: `files`

### Error: "Invalid file type"
**Solution:** Only JPEG, JPG, PNG, and WebP images are allowed. Convert your file if needed.

### Error: "File too large"
**Solution:** File must be less than 5MB. Compress or resize your image.

### Error: "Unauthorized" or 401
**Solution:** 
1. Make sure you're logged in
2. Include the JWT token in the Authorization header
3. Token format: `Authorization: Bearer <token>`

### Error: "Forbidden" or 403
**Solution:** Check that your user role has permission for the upload endpoint:
- Profile upload: ADMIN, DOCTOR, PATIENT
- Doctor docs: DOCTOR only
- Clinic images: DOCTOR only
- Product images: DOCTOR, PHARMACY
- Blog images: ADMIN, DOCTOR
- Pharmacy logo: PHARMACY, ADMIN
- General: ADMIN, DOCTOR, PATIENT

## ✅ Success Response

When upload is successful, you'll receive:
```json
{
  "success": true,
  "message": "File uploaded",
  "data": {
    "url": "/uploads/profile/1234567890-image.jpg"
  }
}
```

For multiple files:
```json
{
  "success": true,
  "message": "Files uploaded",
  "data": {
    "urls": [
      "/uploads/clinic/1234567890-image1.jpg",
      "/uploads/clinic/1234567891-image2.jpg"
    ]
  }
}
```

## 🔗 Accessing Uploaded Files

Uploaded files are accessible at:
```
http://localhost:5000/uploads/<folder>/<filename>
```

Example:
```
http://localhost:5000/uploads/profile/1234567890-image.jpg
```

---

**Need Help?** Check `SETUP_GUIDE.md` for general setup and troubleshooting.
