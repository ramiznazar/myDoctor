/**
 * Generate Admin JWT Token for Testing
 * 
 * This script generates a JWT token directly for admin user
 * Useful when login endpoint is not working
 * 
 * Usage:
 *   node generate-admin-token.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('./src/config/env');

// Get admin email
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mydoctor.com';
const JWT_SECRET = config.JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = config.JWT_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '7d';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/mydoctor';

async function generateAdminToken() {
  try {
    console.log('🔑 Generating Admin JWT Token...\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find admin user
    const User = require('./src/models/user.model');
    const admin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    
    if (!admin) {
      console.log('❌ Admin user not found!');
      console.log('   Email:', ADMIN_EMAIL);
      console.log('\n   Run: npm run seed:admin');
      process.exit(1);
    }

    console.log('✅ Admin user found:');
    console.log('   Email:', admin.email);
    console.log('   Role:', admin.role);
    console.log('   Status:', admin.status);
    console.log('   User ID:', admin._id);

    // Check if admin role and status are correct
    if (admin.role !== 'ADMIN') {
      console.log('\n⚠️  Warning: User role is not ADMIN!');
      console.log('   Current role:', admin.role);
    }

    if (admin.status !== 'APPROVED') {
      console.log('\n⚠️  Warning: User status is not APPROVED!');
      console.log('   Current status:', admin.status);
    }

    // Generate JWT token
    console.log('\n🔐 Generating JWT token...');
    const tokenPayload = {
      userId: admin._id.toString(),
      email: admin.email,
      role: admin.role
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ADMIN TOKEN GENERATED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📋 Token Details:');
    console.log('   User ID:', admin._id.toString());
    console.log('   Email:', admin.email);
    console.log('   Role:', admin.role);
    console.log('   Expires In:', JWT_EXPIRES_IN);
    console.log('\n🔑 JWT Token:\n');
    console.log(token);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📝 How to Use in Postman:');
    console.log('   1. Copy the token above');
    console.log('   2. In Postman, go to "Authorization" tab');
    console.log('   3. Select "Bearer Token"');
    console.log('   4. Paste the token in the "Token" field');
    console.log('\n   Or add as header:');
    console.log('   Authorization: Bearer ' + token.substring(0, 50) + '...');
    console.log('\n📝 Example API Call:');
    console.log('   GET http://localhost:5000/api/admin/dashboard');
    console.log('   Headers:');
    console.log('     Authorization: Bearer ' + token.substring(0, 50) + '...');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Also save to file for easy access
    const fs = require('fs');
    const tokenData = {
      token: token,
      user: {
        id: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        status: admin.status
      },
      generatedAt: new Date().toISOString(),
      expiresIn: JWT_EXPIRES_IN
    };
    
    fs.writeFileSync('admin-token.json', JSON.stringify(tokenData, null, 2));
    console.log('💾 Token saved to: admin-token.json');
    console.log('   You can read it later: cat admin-token.json (or open in editor)\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error generating token:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the script
generateAdminToken();

