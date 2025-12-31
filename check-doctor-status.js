/**
 * Check Doctor Status Script
 * 
 * This script checks the status of doctors in the database
 * 
 * Usage:
 *   node check-doctor-status.js
 *   node check-doctor-status.js <doctorId>
 *   node check-doctor-status.js --all
 *   node check-doctor-status.js --pending
 *   node check-doctor-status.js --approved
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user.model');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/mydoctor';

async function checkDoctorStatus() {
  try {
    console.log('🔍 Checking Doctor Status...\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected!\n');

    const dbName = mongoose.connection.db.databaseName;
    console.log('📊 Database:', dbName);
    console.log('');

    // Get command line arguments
    const args = process.argv.slice(2);
    const doctorId = args[0];
    const flag = args[0];

    if (doctorId && !doctorId.startsWith('--')) {
      // Check specific doctor by ID
      console.log(`🔍 Checking doctor with ID: ${doctorId}\n`);
      
      const doctor = await User.findById(doctorId).populate('doctorProfile');
      
      if (!doctor) {
        console.log('❌ Doctor not found with ID:', doctorId);
        process.exit(1);
      }

      if (doctor.role !== 'DOCTOR') {
        console.log('⚠️  User found but role is not DOCTOR');
        console.log('   Role:', doctor.role);
      }

      displayDoctorDetails(doctor);
      
    } else if (flag === '--all') {
      // Show all doctors
      console.log('📋 All Doctors:\n');
      const doctors = await User.find({ role: 'DOCTOR' }).populate('doctorProfile').sort({ createdAt: -1 });
      
      if (doctors.length === 0) {
        console.log('❌ No doctors found in database');
      } else {
        console.log(`✅ Found ${doctors.length} doctor(s):\n`);
        doctors.forEach((doctor, index) => {
          console.log(`\n${index + 1}. ${doctor.fullName || 'N/A'}`);
          displayDoctorDetails(doctor, true);
        });
      }
      
    } else if (flag === '--pending') {
      // Show pending doctors
      console.log('⏳ Pending Doctors:\n');
      const doctors = await User.find({ role: 'DOCTOR', status: 'PENDING' }).populate('doctorProfile').sort({ createdAt: -1 });
      
      if (doctors.length === 0) {
        console.log('✅ No pending doctors');
      } else {
        console.log(`⚠️  Found ${doctors.length} pending doctor(s):\n`);
        doctors.forEach((doctor, index) => {
          console.log(`\n${index + 1}. ${doctor.fullName || 'N/A'}`);
          displayDoctorDetails(doctor, true);
        });
      }
      
    } else if (flag === '--approved') {
      // Show approved doctors
      console.log('✅ Approved Doctors:\n');
      const doctors = await User.find({ role: 'DOCTOR', status: 'APPROVED' }).populate('doctorProfile').sort({ createdAt: -1 });
      
      if (doctors.length === 0) {
        console.log('❌ No approved doctors');
      } else {
        console.log(`✅ Found ${doctors.length} approved doctor(s):\n`);
        doctors.forEach((doctor, index) => {
          console.log(`\n${index + 1}. ${doctor.fullName || 'N/A'}`);
          displayDoctorDetails(doctor, true);
        });
      }
      
    } else {
      // Show summary
      console.log('📊 Doctor Status Summary:\n');
      
      const totalDoctors = await User.countDocuments({ role: 'DOCTOR' });
      const pendingDoctors = await User.countDocuments({ role: 'DOCTOR', status: 'PENDING' });
      const approvedDoctors = await User.countDocuments({ role: 'DOCTOR', status: 'APPROVED' });
      const rejectedDoctors = await User.countDocuments({ role: 'DOCTOR', status: 'REJECTED' });
      const blockedDoctors = await User.countDocuments({ role: 'DOCTOR', status: 'BLOCKED' });
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📈 Statistics:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   Total Doctors:     ${totalDoctors}`);
      console.log(`   ⏳ Pending:         ${pendingDoctors}`);
      console.log(`   ✅ Approved:        ${approvedDoctors}`);
      console.log(`   ❌ Rejected:        ${rejectedDoctors}`);
      console.log(`   🚫 Blocked:         ${blockedDoctors}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Show recent doctors
      console.log('📋 Recent Doctors (Last 5):\n');
      const recentDoctors = await User.find({ role: 'DOCTOR' })
        .populate('doctorProfile')
        .sort({ updatedAt: -1 })
        .limit(5);
      
      if (recentDoctors.length === 0) {
        console.log('❌ No doctors found');
      } else {
        recentDoctors.forEach((doctor, index) => {
          const statusIcon = getStatusIcon(doctor.status);
          console.log(`${index + 1}. ${statusIcon} ${doctor.fullName || 'N/A'}`);
          console.log(`   ID: ${doctor._id}`);
          console.log(`   Email: ${doctor.email || 'N/A'}`);
          console.log(`   Status: ${doctor.status || 'N/A'}`);
          console.log(`   Updated: ${doctor.updatedAt ? new Date(doctor.updatedAt).toLocaleString() : 'N/A'}`);
          console.log('');
        });
      }
      
      console.log('\n💡 Usage:');
      console.log('   node check-doctor-status.js                    # Show summary');
      console.log('   node check-doctor-status.js <doctorId>          # Check specific doctor');
      console.log('   node check-doctor-status.js --all               # Show all doctors');
      console.log('   node check-doctor-status.js --pending           # Show pending doctors');
      console.log('   node check-doctor-status.js --approved          # Show approved doctors');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

function displayDoctorDetails(doctor, compact = false) {
  const statusIcon = getStatusIcon(doctor.status);
  
  if (compact) {
    console.log(`   ${statusIcon} Status: ${doctor.status || 'N/A'}`);
    console.log(`   📧 Email: ${doctor.email || 'N/A'}`);
    console.log(`   📞 Phone: ${doctor.phone || 'N/A'}`);
    console.log(`   🆔 ID: ${doctor._id}`);
    console.log(`   📅 Created: ${doctor.createdAt ? new Date(doctor.createdAt).toLocaleString() : 'N/A'}`);
    console.log(`   📅 Updated: ${doctor.updatedAt ? new Date(doctor.updatedAt).toLocaleString() : 'N/A'}`);
  } else {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Doctor Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Name:        ${doctor.fullName || 'N/A'}`);
    console.log(`   Email:       ${doctor.email || 'N/A'}`);
    console.log(`   Phone:       ${doctor.phone || 'N/A'}`);
    console.log(`   Gender:      ${doctor.gender || 'N/A'}`);
    console.log(`   Role:        ${doctor.role || 'N/A'}`);
    console.log(`   ${statusIcon} Status:      ${doctor.status || 'N/A'}`);
    console.log(`   User ID:     ${doctor._id}`);
    console.log(`   Created:     ${doctor.createdAt ? new Date(doctor.createdAt).toLocaleString() : 'N/A'}`);
    console.log(`   Updated:     ${doctor.updatedAt ? new Date(doctor.updatedAt).toLocaleString() : 'N/A'}`);
    
    if (doctor.doctorProfile) {
      console.log(`   Profile ID:  ${doctor.doctorProfile._id || 'N/A'}`);
      if (doctor.doctorProfile.specialization) {
        console.log(`   Specialization: ${doctor.doctorProfile.specialization.name || doctor.doctorProfile.specialization || 'N/A'}`);
      }
    }
    
    if (doctor.documentUploads && doctor.documentUploads.length > 0) {
      console.log(`   Documents:   ${doctor.documentUploads.length} file(s) uploaded`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'APPROVED':
      return '✅';
    case 'PENDING':
      return '⏳';
    case 'REJECTED':
      return '❌';
    case 'BLOCKED':
      return '🚫';
    default:
      return '❓';
  }
}

// Run the script
checkDoctorStatus();

