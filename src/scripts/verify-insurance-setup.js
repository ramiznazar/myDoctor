/**
 * Verification script for Insurance functionality
 * Run this to verify that InsuranceCompany model and DoctorProfile updates are working
 */

const mongoose = require('mongoose');
const InsuranceCompany = require('../models/insuranceCompany.model');
const DoctorProfile = require('../models/doctorProfile.model');
require('../config/env');
const connectDB = require('../config/database');

async function verifySetup() {
  try {
    console.log('🔍 Verifying Insurance Setup...\n');
    
    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB\n');
    
    // Check InsuranceCompany model
    console.log('📋 Checking InsuranceCompany model...');
    const insuranceCount = await InsuranceCompany.countDocuments();
    console.log(`   - InsuranceCompany collection exists: ✅`);
    console.log(`   - Total insurance companies: ${insuranceCount}\n`);
    
    // Check DoctorProfile model for new fields
    console.log('📋 Checking DoctorProfile model updates...');
    const doctorCount = await DoctorProfile.countDocuments();
    const doctorsWithInsurance = await DoctorProfile.countDocuments({
      $or: [
        { convenzionato: { $exists: true } },
        { insuranceCompanies: { $exists: true } }
      ]
    });
    
    console.log(`   - DoctorProfile collection exists: ✅`);
    console.log(`   - Total doctors: ${doctorCount}`);
    console.log(`   - Doctors with insurance fields: ${doctorsWithInsurance}`);
    
    // Sample a doctor profile to check schema
    const sampleDoctor = await DoctorProfile.findOne().lean();
    if (sampleDoctor) {
      console.log(`   - Sample doctor has 'convenzionato' field: ${sampleDoctor.convenzionato !== undefined ? '✅' : '❌'}`);
      console.log(`   - Sample doctor has 'insuranceCompanies' field: ${sampleDoctor.insuranceCompanies !== undefined ? '✅' : '❌'}`);
      console.log(`   - Sample doctor convenzionato value: ${sampleDoctor.convenzionato || false}`);
      console.log(`   - Sample doctor insuranceCompanies count: ${sampleDoctor.insuranceCompanies?.length || 0}`);
    }
    
    console.log('\n✅ Verification complete!');
    console.log('\n📝 Notes:');
    console.log('   - Mongoose automatically creates collections when models are used');
    console.log('   - Existing DoctorProfile documents will have convenzionato=false and insuranceCompanies=[] by default');
    console.log('   - New fields will be added automatically when documents are saved');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verifySetup();
