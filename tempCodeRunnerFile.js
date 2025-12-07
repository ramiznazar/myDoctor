// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use("mydoctor_db");

// Find a document in a collection.
db.users.insertOne({
    fullName: "System Admin",
    email: "admin@mydoctor.com",
    password: "$2b$10$VqGwVKP7Cp1Y8HhdBBCUo.yk91fSBT21xqK5P3S.eh0j5rNCVGC4O", 
    role: "ADMIN",
    status: "APPROVED",
    subscriptionStatus: "NONE",
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  
