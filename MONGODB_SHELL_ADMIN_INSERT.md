# MongoDB Shell - Insert Admin User

## Quick Method: Use the Seeder (Recommended)

```bash
cd myDoctor
node src/seeders/admin.seeder.js
```

This is the easiest and most reliable method.

---

## Manual Method: MongoDB Shell

### Step 1: Generate Password Hash

Run this command to get the password hash:

```bash
cd myDoctor
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('admin123456', 10).then(h=>console.log('Hash:', h))"
```

**Or use the helper script:**
```bash
node mongodb-shell-insert-admin.js
```

This will show you the complete MongoDB shell commands.

---

### Step 2: Connect to MongoDB

**Option A: MongoDB Shell (mongosh)**
```bash
mongosh mongodb://localhost:27017/mydoctor
```

**Option B: MongoDB Compass**
- Open MongoDB Compass
- Connect to `mongodb://localhost:27017`
- Select database `mydoctor`

---

### Step 3: Delete Existing Admin (Optional)

If admin already exists, delete it first:

```javascript
db.users.deleteOne({ email: "admin@mydoctor.com" })
```

---

### Step 4: Insert Admin User

**Copy and paste this command in MongoDB Shell:**

```javascript
db.users.insertOne({
  "email": "admin@mydoctor.com",
  "password": "<PASTE_HASH_FROM_STEP_1>",
  "fullName": "Admin User",
  "role": "ADMIN",
  "status": "APPROVED",
  "createdAt": new Date(),
  "updatedAt": new Date()
})
```

**Replace `<PASTE_HASH_FROM_STEP_1>` with the hash from Step 1.**

**Example with actual hash:**
```javascript
db.users.insertOne({
  "email": "admin@mydoctor.com",
  "password": "$2a$10$KkvenEMSDxVVQZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq",
  "fullName": "Admin User",
  "role": "ADMIN",
  "status": "APPROVED",
  "createdAt": new Date(),
  "updatedAt": new Date()
})
```

---

### Step 5: Verify Admin User

```javascript
db.users.findOne({ email: "admin@mydoctor.com" })
```

You should see:
- `email`: "admin@mydoctor.com"
- `role`: "ADMIN"
- `status`: "APPROVED"
- `password`: Should start with `$2a$10$` or similar

---

## Using MongoDB Compass (GUI Method)

1. **Open MongoDB Compass**
2. **Connect** to `mongodb://localhost:27017`
3. **Select database** `mydoctor`
4. **Go to** `users` collection
5. **Click** "Insert Document"
6. **Paste this JSON:**

```json
{
  "email": "admin@mydoctor.com",
  "password": "<PASTE_HASH_FROM_STEP_1>",
  "fullName": "Admin User",
  "role": "ADMIN",
  "status": "APPROVED",
  "createdAt": {
    "$date": "2024-01-01T00:00:00.000Z"
  },
  "updatedAt": {
    "$date": "2024-01-01T00:00:00.000Z"
  }
}
```

**Important:** Replace `<PASTE_HASH_FROM_STEP_1>` with the actual bcrypt hash.

---

## Complete Example (All in One)

### Generate Hash and Get Commands:

```bash
cd myDoctor
node mongodb-shell-insert-admin.js
```

This will output the complete MongoDB shell commands ready to copy-paste.

---

## Verify Password Hash Format

The password hash should:
- Start with `$2a$10$` or `$2b$10$` or `$2y$10$`
- Be about 60 characters long
- Look like: `$2a$10$KkvenEMSDxVVQZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq`

**If your hash doesn't look like this, it's wrong!**

---

## Troubleshooting

### Error: "E11000 duplicate key error"
- Admin already exists
- Delete it first: `db.users.deleteOne({ email: "admin@mydoctor.com" })`

### Error: "Invalid password hash"
- Make sure you're using bcrypt hash (starts with `$2a$`)
- Don't use plain text password
- Generate hash using the Node.js command above

### Error: "Role must be ADMIN"
- Make sure `role` is exactly `"ADMIN"` (uppercase, in quotes)
- Check for typos

### Still getting "Invalid email or password"
1. Verify admin exists: `db.users.findOne({ email: "admin@mydoctor.com" })`
2. Check password hash format
3. Verify backend server is running
4. Check API endpoint: `http://localhost:5000/api/auth/login`

---

## Quick Test

After inserting, test login:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@mydoctor.com\",\"password\":\"admin123456\"}"
```

---

## Recommended: Use Seeder

The easiest way is to use the seeder:

```bash
cd myDoctor
node src/seeders/admin.seeder.js
```

This handles everything automatically!

