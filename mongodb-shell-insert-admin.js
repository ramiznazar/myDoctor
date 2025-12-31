/**
 * MongoDB Shell Script to Insert Admin User
 * 
 * This generates the MongoDB shell commands you can copy and paste
 * 
 * Steps:
 * 1. Generate password hash using Node.js
 * 2. Copy the hash
 * 3. Use MongoDB Shell commands below
 */

const bcrypt = require('bcryptjs');

const ADMIN_EMAIL = 'admin@mydoctor.com';
const ADMIN_PASSWORD = 'admin123456';
const ADMIN_NAME = 'Admin User';

async function generateMongoShellCommands() {
  // Generate password hash
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('MongoDB Shell Commands to Insert Admin User');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Step 1: Connect to MongoDB');
  console.log('  mongosh mongodb://localhost:27017/mydoctor\n');
  
  console.log('Step 2: Switch to your database (if not already)');
  console.log('  use mydoctor\n');
  
  console.log('Step 3: Delete existing admin (if exists)');
  console.log('  db.users.deleteOne({ email: "admin@mydoctor.com" })\n');
  
  console.log('Step 4: Insert admin user');
  console.log('  Copy and paste this command:\n');
  
  const insertCommand = `db.users.insertOne({
  "email": "${ADMIN_EMAIL}",
  "password": "${hash}",
  "fullName": "${ADMIN_NAME}",
  "role": "ADMIN",
  "status": "APPROVED",
  "createdAt": new Date(),
  "updatedAt": new Date()
})`;
  
  console.log(insertCommand);
  console.log('\n');
  
  console.log('Step 5: Verify admin was created');
  console.log('  db.users.findOne({ email: "admin@mydoctor.com" })\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Login Credentials:');
  console.log('  Email: ' + ADMIN_EMAIL);
  console.log('  Password: ' + ADMIN_PASSWORD);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('✅ Copy the insertOne command above and paste it in MongoDB Shell');
}

generateMongoShellCommands().catch(console.error);

