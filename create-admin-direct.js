/**
 * Direct MongoDB method to create admin user
 * This bypasses the User model and directly inserts into MongoDB
 * 
 * Usage:
 *   node create-admin-direct.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Get admin credentials from environment or use defaults
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mydoctor.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/mydoctor';

async function createAdminDirect() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the database and collection directly
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Check if admin already exists
    const existingAdmin = await usersCollection.findOne({ 
      email: ADMIN_EMAIL.toLowerCase() 
    });

    if (existingAdmin) {
      console.log('\n⚠️  Admin user already exists!');
      console.log('Email:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);
      console.log('Status:', existingAdmin.status);
      
      // Ask if user wants to update password
      console.log('\nDo you want to update the password? (y/n)');
      console.log('Or run: node reset-admin-password.js');
      process.exit(0);
    }

    // Hash password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // Create admin user document directly
    const adminDoc = {
      email: ADMIN_EMAIL.toLowerCase(),
      password: hashedPassword,
      fullName: ADMIN_NAME,
      role: 'ADMIN',
      status: 'APPROVED',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert directly into collection
    console.log('Creating admin user...');
    const result = await usersCollection.insertOne(adminDoc);

    console.log('\n✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:', ADMIN_EMAIL);
    console.log('Password:', ADMIN_PASSWORD);
    console.log('Name:', ADMIN_NAME);
    console.log('Role: ADMIN');
    console.log('Status: APPROVED');
    console.log('User ID:', result.insertedId);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');
    console.log('\nYou can now login at:');
    console.log('  POST http://localhost:5000/api/auth/login');
    console.log('  Body: { "email": "' + ADMIN_EMAIL + '", "password": "' + ADMIN_PASSWORD + '" }');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    if (error.code === 11000) {
      console.error('Email already exists in database');
    }
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
createAdminDirect();

