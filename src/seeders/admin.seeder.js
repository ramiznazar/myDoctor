/**
 * Admin User Seeder
 * Creates an admin user in the database
 * 
 * Usage:
 *   node src/seeders/admin.seeder.js
 * 
 * Or with custom values:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=password123 node src/seeders/admin.seeder.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');

// Get admin credentials from environment or use defaults
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mydoctor.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/mydoctor';

async function seedAdmin() {
  try {
    console.log('🌱 Starting Admin Seeder...\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check if admin already exists
    console.log('🔍 Checking if admin user exists...');
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('   Email:', existingAdmin.email);
      console.log('   Role:', existingAdmin.role);
      console.log('   Status:', existingAdmin.status);
      console.log('\n🔄 Updating admin user...');
      
      // Update existing admin
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      existingAdmin.password = hashedPassword;
      existingAdmin.fullName = ADMIN_NAME;
      existingAdmin.role = 'ADMIN';
      existingAdmin.status = 'APPROVED';
      existingAdmin.updatedAt = new Date();
      
      await existingAdmin.save();
      console.log('✅ Admin user updated successfully!\n');
    } else {
      console.log('➕ Creating new admin user...');
      
      // Hash password
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      
      // Create admin user
      const admin = await User.create({
        email: ADMIN_EMAIL.toLowerCase(),
        password: hashedPassword,
        fullName: ADMIN_NAME,
        role: 'ADMIN',
        status: 'APPROVED'
      });
      
      console.log('✅ Admin user created successfully!\n');
    }

    // Verify the admin user
    console.log('✅ Verifying admin user...');
    const admin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() }).select('+password');
    
    if (!admin) {
      throw new Error('Admin user was not created!');
    }

    // Test password
    const passwordMatch = await bcrypt.compare(ADMIN_PASSWORD, admin.password);
    if (!passwordMatch) {
      throw new Error('Password verification failed!');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ADMIN USER SEEDED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Password:', ADMIN_PASSWORD);
    console.log('👤 Name:', admin.fullName);
    console.log('🎭 Role:', admin.role);
    console.log('📊 Status:', admin.status);
    console.log('🆔 User ID:', admin._id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📝 Login Credentials:');
    console.log('   POST http://localhost:5000/api/auth/login');
    console.log('   Body: {');
    console.log('     "email": "' + admin.email + '",');
    console.log('     "password": "' + ADMIN_PASSWORD + '"');
    console.log('   }');
    console.log('\n✅ Password verification: PASSED');
    console.log('✅ All checks passed!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding admin:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run seeder
seedAdmin();

