# ----------------------------------
# SERVER CONFIG
# ----------------------------------
PORT=5000
NODE_ENV=development

# ----------------------------------
# DATABASE CONFIG
# ----------------------------------
MONGO_URI=mongodb://localhost:27017/mydoctor_db

# ----------------------------------
# JWT CONFIG
# ----------------------------------
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRES_IN=30d

# ----------------------------------
# MULTER UPLOAD PATHS
# (Cursor already uses these folder names)
# ----------------------------------
UPLOAD_PROFILE=uploads/profile
UPLOAD_DOCTOR_DOCS=uploads/doctor-documents
UPLOAD_CLINIC=uploads/clinic
UPLOAD_PRODUCT=uploads/product
UPLOAD_BLOG=uploads/blog
UPLOAD_PHARMACY=uploads/pharmacy
UPLOAD_GENERAL=uploads/general

# ----------------------------------
# EMAIL CONFIG (for future notifications)
# ----------------------------------
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password

# ----------------------------------
# PAYMENT CONFIG (Stripe or PayPal)
# ----------------------------------
STRIPE_SECRET_KEY=stripe_secret_here
PAYPAL_CLIENT_ID=paypal_client_id_here
PAYPAL_SECRET=paypal_secret_here

# ----------------------------------
# VIDEO CALL / WEBRTC KEYS (OPTIONAL)
# ----------------------------------
WEBRTC_API_KEY=dummy_key
WEBRTC_SECRET=dummy_secret
