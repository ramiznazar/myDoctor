/**
 * Complete Admin Setup Script
 * 
 * This script will:
 * 1. Delete existing admin (if exists)
 * 2. Create fresh admin user
 * 3. Generate JWT token
 * 4. Save everything to file
 * 
 * Usage:
 *   node setup-admin-complete.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const config = require('./src/config/env');
const User = require('./src/models/user.model');

// Admin credentials
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mydoctor.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';
const JWT_SECRET = config.JWT_SECRET || process.env.JWT_SECRET;
const JWT_EXPIRES_IN = config.JWT_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '7d';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/mydoctor';

async function setupAdmin() {
  try {
    console.log('🚀 Complete Admin Setup\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Step 1: Connect to MongoDB
    console.log('Step 1: Connecting to MongoDB...');
    console.log('   URI:', MONGODB_URI.replace(/\/\/.*@/, '//***@')); // Hide credentials
    await mongoose.connect(MONGODB_URI);
    console.log('   ✅ Connected!\n');

    // Step 2: Check database name
    const dbName = mongoose.connection.db.databaseName;
    console.log('Step 2: Database Info');
    console.log('   Database:', dbName);
    console.log('   Collection: users\n');

    // Step 3: Delete existing admin
    console.log('Step 3: Checking for existing admin...');
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    
    if (existingAdmin) {
      console.log('   ⚠️  Admin user found, deleting...');
      console.log('   ID:', existingAdmin._id);
      await User.deleteOne({ _id: existingAdmin._id });
      console.log('   ✅ Deleted existing admin\n');
    } else {
      console.log('   ✅ No existing admin found\n');
    }

    // Step 4: Create new admin
    console.log('Step 4: Creating new admin user...');
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    
    const admin = await User.create({
      email: ADMIN_EMAIL.toLowerCase(),
      password: hashedPassword,
      fullName: ADMIN_NAME,
      role: 'ADMIN',
      status: 'APPROVED'
    });
    
    console.log('   ✅ Admin user created!');
    console.log('   ID:', admin._id);
    console.log('   Email:', admin.email);
    console.log('   Role:', admin.role);
    console.log('   Status:', admin.status);
    console.log('');

    // Step 5: Verify admin exists
    console.log('Step 5: Verifying admin user...');
    const verifyAdmin = await User.findById(admin._id).select('+password');
    if (!verifyAdmin) {
      throw new Error('Admin user was not created!');
    }
    console.log('   ✅ Admin verified in database\n');

    // Step 6: Test password
    console.log('Step 6: Testing password...');
    if (!verifyAdmin.password) {
      throw new Error('Password field is missing!');
    }
    const passwordMatch = await bcrypt.compare(ADMIN_PASSWORD, verifyAdmin.password);
    if (!passwordMatch) {
      throw new Error('Password verification failed!');
    }
    console.log('   ✅ Password verified\n');

    // Step 7: Generate JWT token
    console.log('Step 7: Generating JWT token...');
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET is not set in environment variables!');
    }
    
    const tokenPayload = {
      userId: admin._id.toString(),
      email: admin.email,
      role: admin.role
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });
    
    console.log('   ✅ Token generated\n');

    // Step 8: Verify token
    console.log('Step 8: Verifying token...');
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('   ✅ Token is valid');
      console.log('   User ID:', decoded.userId);
      console.log('   Email:', decoded.email);
      console.log('   Role:', decoded.role);
      console.log('');
    } catch (error) {
      throw new Error('Token verification failed: ' + error.message);
    }

    // Step 9: Save to file
    console.log('Step 9: Saving to file...');
    const adminData = {
      admin: {
        id: admin._id.toString(),
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        status: admin.status
      },
      credentials: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      },
      token: {
        value: token,
        expiresIn: JWT_EXPIRES_IN,
        generatedAt: new Date().toISOString()
      },
      database: {
        name: dbName,
        connection: MONGODB_URI.replace(/\/\/.*@/, '//***@')
      }
    };

    fs.writeFileSync('admin-setup-complete.json', JSON.stringify(adminData, null, 2));
    console.log('   ✅ Saved to: admin-setup-complete.json\n');

    // Final summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ADMIN SETUP COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📋 Admin User:');
    console.log('   ID:', admin._id.toString());
    console.log('   Email:', admin.email);
    console.log('   Name:', admin.fullName);
    console.log('   Role:', admin.role);
    console.log('   Status:', admin.status);
    console.log('');
    
    console.log('🔑 Login Credentials:');
    console.log('   Email:', ADMIN_EMAIL);
    console.log('   Password:', ADMIN_PASSWORD);
    console.log('');
    
    console.log('🎫 JWT Token:');
    console.log('   ' + token);
    console.log('');
    
    console.log('📝 How to Use:');
    console.log('   1. Copy the token above');
    console.log('   2. In Postman, go to Authorization tab');
    console.log('   3. Select "Bearer Token"');
    console.log('   4. Paste the token');
    console.log('   5. Test: GET http://localhost:5000/api/admin/dashboard');
    console.log('');
    
    console.log('💾 All data saved to: admin-setup-complete.json');
    console.log('   You can read it: cat admin-setup-complete.json\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run setup
setupAdmin();

