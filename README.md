# MyDoctore Backend

A complete Express.js backend application with MongoDB, JWT authentication, and BullMQ for job queues.

## 🏗️ Architecture

This project follows a **layered architecture** pattern:

- **Controllers**: Handle HTTP requests/responses, call services
- **Services**: Implement business logic, call repositories
- **Repositories**: Interact with database models
- **Validators**: Zod schemas for request validation
- **Middleware**: Authentication, validation, error handling
- **Queue/Workers**: Background job processing with BullMQ

## 📁 Project Structure

```
/src
 ├── app.js                 # Express app configuration
 ├── server.js              # Server entry point
 ├── config/                # Configuration files
 │   ├── env.js            # Environment variables
 │   └── database.js       # MongoDB connection
 ├── controllers/           # Request handlers
 │   ├── auth.controller.js
 │   └── user.controller.js
 ├── services/              # Business logic
 │   ├── auth.service.js
 │   └── user.service.js
 ├── repositories/          # Database operations
 │   └── user.repository.js
 ├── validators/            # Zod validation schemas
 │   ├── auth.validators.js
 │   └── user.validators.js
 ├── middleware/            # Express middleware
 │   ├── asyncHandler.js
 │   ├── validate.js
 │   ├── authGuard.js
 │   └── errorHandler.js
 ├── routes/                # API routes
 │   ├── index.js
 │   ├── auth.routes.js
 │   └── user.routes.js
 ├── types/                 # Enums and type definitions
 │   ├── enums.js
 │   └── global.types.js
 ├── utils/                 # Utility functions
 │   ├── jwt.js
 │   └── response.js
 ├── models/                # Mongoose models
 │   └── User.js
 ├── queue/                 # BullMQ queues
 │   └── example.queue.js
 └── workers/               # BullMQ workers
     └── example.worker.js
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or connection string)
- Redis (for BullMQ queues)

### Installation

1. **Clone the repository** (or navigate to project directory)

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   PORT=3000
   NODE_ENV=development
   MONGO_URI=mongodb://localhost:27017/mydoctore
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRE=7d
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

4. **Start MongoDB and Redis:**
   - Make sure MongoDB is running on your system
   - Make sure Redis is running (required for BullMQ)

5. **Run the application:**
   ```bash
   # Development mode (with nodemon)
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Start the worker** (in a separate terminal):
   ```bash
   node src/workers/example.worker.js
   ```

The server will start on `http://localhost:3000`

## 📡 API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get current user profile (Protected)

### Users (Admin only)

- `GET /api/users` - Get all users (paginated)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Health Check

- `GET /api/health` - Server health check

## 🔐 Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### User Roles

- `ADMIN` - Full access
- `VENDOR` - Vendor access
- `CUSTOMER` - Customer access (default)

## 📝 API Response Format

### Success Response
```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## 🧪 Example API Calls

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "CUSTOMER"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Get Profile (Protected)
```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer <your-token>"
```

## 🔧 Adding New Modules

To add a new module (e.g., `Product`):

1. **Create Model** (`src/models/Product.js`)
2. **Create Repository** (`src/repositories/product.repository.js`)
3. **Create Validators** (`src/validators/product.validators.js`)
4. **Create Service** (`src/services/product.service.js`)
5. **Create Controller** (`src/controllers/product.controller.js`)
6. **Create Routes** (`src/routes/product.routes.js`)
7. **Register Routes** in `src/routes/index.js`

### Example Route Pattern:
```javascript
router.post(
  '/products',
  validate(createProductSchema),
  authGuard([USER_ROLES.ADMIN]),
  asyncHandler(productController.createProduct)
);
```

## 🎯 Key Features

- ✅ Layered architecture (Controllers → Services → Repositories)
- ✅ JWT authentication with role-based access control
- ✅ Zod validation for all requests
- ✅ Unified JSON response format
- ✅ Async error handling with asyncHandler
- ✅ BullMQ for background job processing
- ✅ MongoDB with Mongoose
- ✅ All fields nullable as per requirements
- ✅ Clean, scalable code structure

## 📦 Dependencies

- **express** - Web framework
- **mongoose** - MongoDB ODM
- **zod** - Schema validation
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing
- **bullmq** - Job queue
- **ioredis** - Redis client
- **dotenv** - Environment variables
- **cors** - CORS middleware

## 🛠️ Development

- Use `npm run dev` for development with auto-reload
- Use `npm start` for production
- Workers run separately: `node src/workers/example.worker.js`

## 📄 License

ISC

---

**Built with ❤️ using Express.js and MongoDB**

