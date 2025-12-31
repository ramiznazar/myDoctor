/**
 * MongoDB Shell Script to create admin user
 * 
 * Copy and paste this into MongoDB Shell or MongoDB Compass
 * 
 * Make sure to:
 * 1. Connect to your database
 * 2. Use the correct database: use mydoctor (or your database name)
 * 3. Run the script
 */

// MongoDB Shell Script
const adminEmail = 'admin@mydoctor.com';
const adminPassword = 'admin123456'; // This will be hashed
const adminName = 'Admin User';

// Note: In MongoDB Shell, you need to hash the password first using Node.js
// Or use this script in Node.js environment

// For MongoDB Shell, you would need to:
// 1. Use MongoDB Compass with a function, OR
// 2. Use this Node.js script instead

console.log(`
========================================
MongoDB Shell Script (for reference)
========================================

If you want to use MongoDB Shell directly, you need to:

1. Connect to MongoDB:
   mongosh mongodb://localhost:27017/mydoctor

2. Switch to your database:
   use mydoctor

3. Insert admin user (BUT password needs to be hashed first):
   db.users.insertOne({
     "email": "admin@mydoctor.com",
     "password": "<HASHED_PASSWORD>", // Must be bcrypt hash
     "fullName": "Admin User",
     "role": "ADMIN",
     "status": "APPROVED",
     "createdAt": new Date(),
     "updatedAt": new Date()
   })

⚠️  PROBLEM: You can't hash password in MongoDB Shell directly.
✅  SOLUTION: Use the Node.js script instead (create-admin-direct.js)

========================================
`);

