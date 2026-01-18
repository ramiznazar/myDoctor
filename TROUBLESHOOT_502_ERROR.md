# Troubleshooting 502 Bad Gateway Error

## What 502 Bad Gateway Means
A 502 error means nginx (your web server) cannot connect to the Node.js backend server. This usually happens when:
1. The Node.js server is not running
2. The Node.js server crashed on startup
3. The server is running on a different port than nginx expects

## Steps to Fix

### 1. Check if Server is Running
```bash
# Check if Node.js process is running
ps aux | grep node
# or on Windows
tasklist | findstr node
```

### 2. Check Server Logs
The server logs will show the exact error. Check:
- PM2 logs (if using PM2): `pm2 logs`
- System logs: `/var/log/nginx/error.log` or your server's log location
- Application logs: Check where your Node.js app logs errors

### 3. Try Starting Server Manually
```bash
cd myDoctor
node src/server.js
```

Look for error messages like:
- "Cannot find module..."
- "SyntaxError..."
- "MongoDB connection error..."
- Any other error messages

### 4. Common Issues After Adding Insurance Code

#### Issue 1: Missing Module
If you see "Cannot find module 'insuranceCompany.model'", make sure:
- All files are saved
- The server is restarted after adding new files

#### Issue 2: MongoDB Connection
If you see MongoDB errors, check:
- MongoDB is running
- MONGO_URI in .env is correct
- Network connectivity to MongoDB

#### Issue 3: Port Already in Use
If you see "EADDRINUSE", another process is using the port:
```bash
# Find process using port (usually 5000 or 3000)
netstat -ano | findstr :5000
# Kill the process
taskkill /PID <process_id> /F
```

### 5. Restart Server Properly

#### If using PM2:
```bash
pm2 restart mydoctor-api
# or
pm2 restart all
pm2 logs
```

#### If using systemd:
```bash
sudo systemctl restart mydoctor-api
sudo systemctl status mydoctor-api
```

#### If running manually:
```bash
# Stop the current process (Ctrl+C)
# Then restart:
cd myDoctor
node src/server.js
```

### 6. Verify Insurance Code is Loaded
Once server starts, check if insurance routes are loaded:
```bash
# Test the health endpoint
curl http://localhost:5000/api/health

# Test insurance endpoint (should return empty array if no companies)
curl http://localhost:5000/api/insurance
```

## Quick Fix Checklist
- [ ] Server is running (check process list)
- [ ] No syntax errors in new files
- [ ] MongoDB is connected
- [ ] All dependencies installed (`npm install`)
- [ ] Server logs show no errors
- [ ] Port matches nginx configuration
- [ ] Server restarted after code changes

## If Still Not Working
1. Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`
2. Check nginx configuration for backend port
3. Verify firewall rules allow connection
4. Check if server is binding to correct host (0.0.0.0 vs localhost)
