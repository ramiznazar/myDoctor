/**
 * Script to create an admin user
 * 
 * Usage:
 *   node create-admin.js
 * 
 * Or with custom values:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=password123 node create-admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/user.model');

// Get admin credentials from environment or use defaults
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mydoctor.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/mydoctor';

async function createAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    if (existingAdmin) {
      console.log('\n⚠️  Admin user already exists!');
      console.log('Email:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);
      console.log('Status:', existingAdmin.status);
      console.log('\nTo create a different admin, set ADMIN_EMAIL environment variable.');
      process.exit(0);
    }

    // Hash password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // Create admin user
    console.log('Creating admin user...');
    const admin = await User.create({
      email: ADMIN_EMAIL.toLowerCase(),
      password: hashedPassword,
      fullName: ADMIN_NAME,
      role: 'ADMIN',
      status: 'APPROVED'
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:', admin.email);
    console.log('Password:', ADMIN_PASSWORD);
    console.log('Name:', admin.fullName);
    console.log('Role:', admin.role);
    console.log('Status:', admin.status);
    console.log('User ID:', admin._id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');
    console.log('\nYou can now login at:');
    console.log('  - Main site: http://localhost:3000/login');
    console.log('  - Admin panel: http://localhost:3001/admin/login');
    console.log('\nAPI Endpoint: POST http://localhost:5000/api/auth/login');
    console.log('Request Body: { "email": "' + admin.email + '", "password": "' + ADMIN_PASSWORD + '" }');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    if (error.code === 11000) {
      console.error('Email already exists in database');
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
createAdmin();

