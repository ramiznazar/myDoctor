/**
 * Script to reset admin password
 * 
 * Usage:
 *   node reset-admin-password.js
 * 
 * Or with custom values:
 *   ADMIN_EMAIL=admin@example.com NEW_PASSWORD=newpassword123 node reset-admin-password.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/user.model');

// Get admin credentials from environment or use defaults
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mydoctor.com';
const NEW_PASSWORD = process.env.NEW_PASSWORD || 'admin123456';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/mydoctor';

async function resetAdminPassword() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Find admin user
    const admin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    if (!admin) {
      console.log('\n❌ Admin user not found!');
      console.log('Email:', ADMIN_EMAIL);
      console.log('\nRun create-admin.js first to create an admin user.');
      process.exit(1);
    }

    console.log('\nFound admin user:');
    console.log('Email:', admin.email);
    console.log('Name:', admin.fullName);
    console.log('Role:', admin.role);
    console.log('Status:', admin.status);

    // Hash new password
    console.log('\nHashing new password...');
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);

    // Update password
    console.log('Updating password...');
    admin.password = hashedPassword;
    await admin.save();

    console.log('\n✅ Admin password reset successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:', admin.email);
    console.log('New Password:', NEW_PASSWORD);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nYou can now login with these credentials:');
    console.log('  POST http://localhost:5000/api/auth/login');
    console.log('  Body: { "email": "' + admin.email + '", "password": "' + NEW_PASSWORD + '" }');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error resetting password:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
resetAdminPassword();

