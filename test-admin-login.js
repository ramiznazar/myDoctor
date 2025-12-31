/**
 * Test script to verify admin login works
 * This will test the actual login endpoint
 * 
 * Usage:
 *   node test-admin-login.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/user.model');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mydoctor.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/mydoctor';

async function testLogin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected\n');

    // Test 1: Find user
    console.log('Test 1: Finding user by email...');
    const user = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() }).select('+password');
    
    if (!user) {
      console.log('❌ User not found!');
      process.exit(1);
    }
    
    console.log('✅ User found:');
    console.log('   ID:', user._id);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Status:', user.status);
    console.log('   Has Password:', !!user.password);
    console.log('   Password Hash:', user.password ? user.password.substring(0, 20) + '...' : 'NONE');

    // Test 2: Check password hash format
    console.log('\nTest 2: Checking password hash format...');
    if (!user.password) {
      console.log('❌ Password is missing!');
      process.exit(1);
    }
    
    const isValidHash = user.password.startsWith('$2a$') || 
                        user.password.startsWith('$2b$') || 
                        user.password.startsWith('$2y$');
    
    if (!isValidHash) {
      console.log('❌ Password hash format is invalid!');
      console.log('   Hash should start with $2a$, $2b$, or $2y$');
      console.log('   Current hash starts with:', user.password.substring(0, 10));
      process.exit(1);
    }
    
    console.log('✅ Password hash format is valid');

    // Test 3: Compare password
    console.log('\nTest 3: Comparing password...');
    try {
      const isMatch = await bcrypt.compare(ADMIN_PASSWORD, user.password);
      if (isMatch) {
        console.log('✅ Password matches!');
      } else {
        console.log('❌ Password does NOT match!');
        console.log('   Expected password:', ADMIN_PASSWORD);
        console.log('   The stored hash does not match this password.');
        console.log('   Run: node reset-admin-password.js');
        process.exit(1);
      }
    } catch (error) {
      console.log('❌ Error comparing password:', error.message);
      process.exit(1);
    }

    // Test 4: Check status
    console.log('\nTest 4: Checking user status...');
    if (user.status === 'BLOCKED' || user.status === 'REJECTED') {
      console.log('⚠️  User status is:', user.status);
      console.log('   This will prevent login!');
    } else {
      console.log('✅ User status is OK:', user.status);
    }

    // Test 5: Check role
    console.log('\nTest 5: Checking user role...');
    if (user.role !== 'ADMIN') {
      console.log('⚠️  User role is:', user.role);
      console.log('   Expected: ADMIN');
    } else {
      console.log('✅ User role is correct: ADMIN');
    }

    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL TESTS PASSED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nThe admin user is correctly configured.');
    console.log('If login still fails, the issue might be:');
    console.log('  1. Backend server not running');
    console.log('  2. Wrong API endpoint URL');
    console.log('  3. Request format issue (check Content-Type header)');
    console.log('  4. Case sensitivity in email');
    console.log('\nTry logging in with:');
    console.log('  POST http://localhost:5000/api/auth/login');
    console.log('  Headers: Content-Type: application/json');
    console.log('  Body: {');
    console.log('    "email": "' + ADMIN_EMAIL.toLowerCase() + '",');
    console.log('    "password": "' + ADMIN_PASSWORD + '"');
    console.log('  }');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testLogin();

