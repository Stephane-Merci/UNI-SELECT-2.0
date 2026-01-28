# Setup Guide

## Technology Stack Summary

### Frontend
- **React 18** with TypeScript - Modern UI framework
- **@dnd-kit** - Drag and drop library (better than react-beautiful-dnd)
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool
- **Socket.io-client** - Real-time updates
- **Zustand** - State management

### Backend
- **Node.js** with Express - RESTful API
- **TypeScript** - Type safety
- **Prisma** - Modern ORM for PostgreSQL
- **Socket.io** - WebSocket server for real-time collaboration
- **JWT** - Authentication
- **xlsx (SheetJS)** - Excel export functionality

### Database
- **PostgreSQL** - Relational database

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **PostgreSQL** - [Download](https://www.postgresql.org/download/)
3. **npm** or **yarn**

## Installation Steps

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Set Up Database

1. Create a PostgreSQL database:
```sql
CREATE DATABASE worker_management;
```

2. Copy the environment file:
```bash
cd backend
cp .env.example .env
```

3. Update `backend/.env` with your database credentials:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/worker_management"
JWT_SECRET="your-random-secret-key-here"
PORT=5000
FRONTEND_URL="http://localhost:3000"
```

### 3. Run Database Migrations

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

This will create all the necessary database tables.

### 4. Start Development Servers

**Option 1: Run separately**

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

**Option 2: Run together (from root)**
```bash
npm run dev
```

### 5. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Prisma Studio (Database GUI): `cd backend && npx prisma studio`

## First Time Setup

1. **Create a Manager Account**

You'll need to register a manager account first. You can either:
   - Add a registration endpoint temporarily
   - Use Prisma Studio to create a manager manually
   - Use the API directly:

```bash
curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"username": admin", "email": "admin@example.com", "password": "password123"}'
```

2. **Login** at http://localhost:3000/login

3. **Create Posts** - Click "Créer Poste" to create your first post

4. **Create Workers** - Click "Créer Travailleur" to add workers

5. **Start Assigning** - Drag and drop workers to posts!

## Features

### ✅ Work Allocation Page
- Drag workers from "Non Assignés" to posts
- Drag workers between posts
- Drag workers back to unassigned
- Color-coded by worker type
- Real-time updates when multiple managers work simultaneously

### ✅ Worker Type Management Page
- View all workers organized by type
- Drag workers between types
- Each type has a unique color
- Colors match across both pages

### ✅ Excel Export
- Export all workers with their details
- Export all posts with assigned workers
- Accessible from the navigation bar

### ✅ Real-time Collaboration
- Multiple managers can work simultaneously
- Changes sync in real-time via WebSocket
- No page refresh needed

## Deployment

### Frontend (Vercel/Netlify)
1. Build: `cd frontend && npm run build`
2. Deploy the `dist` folder
3. Set environment variable: `VITE_API_URL=https://your-api-url.com/api`

### Backend (Railway/Render/AWS)
1. Set environment variables
2. Run migrations: `npx prisma migrate deploy`
3. Start: `npm start`

### Database
- Use managed PostgreSQL (Railway, Supabase, AWS RDS, etc.)
- Update `DATABASE_URL` in production `.env`

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Ensure database exists

### Port Already in Use
- Change `PORT` in `backend/.env`
- Update proxy in `frontend/vite.config.ts`

### CORS Errors
- Update `FRONTEND_URL` in `backend/.env`
- Check CORS settings in `backend/src/index.ts`

### Socket.io Connection Issues
- Ensure backend is running
- Check `FRONTEND_URL` matches your frontend URL
- Verify firewall settings

## Next Steps

1. Add authentication middleware to protect routes
2. Add role-based access control
3. Add data validation on frontend
4. Add loading states and error handling
5. Add unit and integration tests
6. Set up CI/CD pipeline
