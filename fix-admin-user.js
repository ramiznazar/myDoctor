/**
 * Comprehensive script to verify and fix admin user
 * This will:
 * 1. Check if admin exists
 * 2. Verify password hash
 * 3. Fix any issues
 * 4. Test login credentials
 * 
 * Usage:
 *   node fix-admin-user.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Get admin credentials
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mydoctor.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/mydoctor';

async function fixAdminUser() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Step 1: Check if admin exists
    console.log('Step 1: Checking if admin user exists...');
    let admin = await usersCollection.findOne({ 
      email: ADMIN_EMAIL.toLowerCase() 
    });

    if (!admin) {
      console.log('❌ Admin user not found. Creating new admin...\n');
      
      // Create new admin
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      const result = await usersCollection.insertOne({
        email: ADMIN_EMAIL.toLowerCase(),
        password: hashedPassword,
        fullName: ADMIN_NAME,
        role: 'ADMIN',
        status: 'APPROVED',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('✅ Admin user created!');
      console.log('   User ID:', result.insertedId);
      admin = await usersCollection.findOne({ _id: result.insertedId });
    } else {
      console.log('✅ Admin user found!');
      console.log('   Email:', admin.email);
      console.log('   Name:', admin.fullName);
      console.log('   Role:', admin.role);
      console.log('   Status:', admin.status);
    }

    // Step 2: Verify and fix role
    console.log('\nStep 2: Verifying role...');
    if (admin.role !== 'ADMIN') {
      console.log('⚠️  Role is not ADMIN. Fixing...');
      await usersCollection.updateOne(
        { _id: admin._id },
        { $set: { role: 'ADMIN', updatedAt: new Date() } }
      );
      console.log('✅ Role fixed to ADMIN');
      admin.role = 'ADMIN';
    } else {
      console.log('✅ Role is correct (ADMIN)');
    }

    // Step 3: Verify and fix status
    console.log('\nStep 3: Verifying status...');
    if (admin.status !== 'APPROVED') {
      console.log('⚠️  Status is not APPROVED. Fixing...');
      await usersCollection.updateOne(
        { _id: admin._id },
        { $set: { status: 'APPROVED', updatedAt: new Date() } }
      );
      console.log('✅ Status fixed to APPROVED');
      admin.status = 'APPROVED';
    } else {
      console.log('✅ Status is correct (APPROVED)');
    }

    // Step 4: Verify and fix password
    console.log('\nStep 4: Verifying password hash...');
    if (!admin.password) {
      console.log('⚠️  Password is missing. Setting new password...');
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await usersCollection.updateOne(
        { _id: admin._id },
        { $set: { password: hashedPassword, updatedAt: new Date() } }
      );
      console.log('✅ Password set');
    } else {
      // Test if password hash is valid
      const isValidHash = admin.password.startsWith('$2a$') || 
                         admin.password.startsWith('$2b$') || 
                         admin.password.startsWith('$2y$');
      
      if (!isValidHash) {
        console.log('⚠️  Password hash is invalid. Resetting...');
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await usersCollection.updateOne(
          { _id: admin._id },
          { $set: { password: hashedPassword, updatedAt: new Date() } }
        );
        console.log('✅ Password hash reset');
      } else {
        // Test password comparison
        try {
          const passwordMatch = await bcrypt.compare(ADMIN_PASSWORD, admin.password);
          if (!passwordMatch) {
            console.log('⚠️  Password hash exists but doesn\'t match. Resetting...');
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
            await usersCollection.updateOne(
              { _id: admin._id },
              { $set: { password: hashedPassword, updatedAt: new Date() } }
            );
            console.log('✅ Password hash reset and verified');
          } else {
            console.log('✅ Password hash is valid and matches');
          }
        } catch (error) {
          console.log('⚠️  Error testing password. Resetting...');
          const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
          await usersCollection.updateOne(
            { _id: admin._id },
            { $set: { password: hashedPassword, updatedAt: new Date() } }
          );
          console.log('✅ Password hash reset');
        }
      }
    }

    // Step 5: Final verification
    console.log('\nStep 5: Final verification...');
    const finalAdmin = await usersCollection.findOne({ _id: admin._id });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ADMIN USER READY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:', finalAdmin.email);
    console.log('Password:', ADMIN_PASSWORD);
    console.log('Name:', finalAdmin.fullName);
    console.log('Role:', finalAdmin.role);
    console.log('Status:', finalAdmin.status);
    console.log('User ID:', finalAdmin._id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Test password one more time
    console.log('\nTesting password verification...');
    const testMatch = await bcrypt.compare(ADMIN_PASSWORD, finalAdmin.password);
    if (testMatch) {
      console.log('✅ Password verification successful!');
    } else {
      console.log('❌ Password verification failed!');
      console.log('   This should not happen. Please check the script.');
    }

    console.log('\n📝 Login Credentials:');
    console.log('   POST http://localhost:5000/api/auth/login');
    console.log('   Body: {');
    console.log('     "email": "' + finalAdmin.email + '",');
    console.log('     "password": "' + ADMIN_PASSWORD + '"');
    console.log('   }');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
fixAdminUser();

