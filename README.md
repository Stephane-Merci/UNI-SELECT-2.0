# Worker Management Application

A collaborative management application for assigning workers to posts with drag-and-drop functionality.

## Features

- **Worker Management**: Create and manage workers with matricule (ID)
- **Post Management**: Create and manage posts/plans
- **Drag & Drop Assignment**: Interactive interface to assign workers to posts
- **Worker Type Management**: Categorize workers by type (Jour, soir, absent, etc.) with color coding
- **Original Post Tracking**: Each worker maintains their original post while being assignable to other posts
- **Excel Export**: Export workers and posts data to Excel files
- **Real-time Collaboration**: Multiple managers can work simultaneously from different devices

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **@dnd-kit/core** & **@dnd-kit/sortable** for drag-and-drop
- **Tailwind CSS** for styling
- **Axios** for API calls
- **Socket.io-client** for real-time updates

### Backend
- **Node.js** with Express
- **TypeScript**
- **Prisma** ORM with PostgreSQL
- **Socket.io** for real-time collaboration
- **JWT** for authentication
- **xlsx** (SheetJS) for Excel export

## Project Structure

```
UNI_SELECT2.0/
├── frontend/          # React application
├── backend/           # Node.js/Express API
├── shared/            # Shared TypeScript types
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. Install dependencies:
```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
```

2. Set up environment variables:
```bash
# Backend .env
DATABASE_URL="postgresql://user:password@localhost:5432/worker_management"
JWT_SECRET="your-secret-key"
PORT=5000
```

3. Run database migrations:
```bash
cd backend
npx prisma migrate dev
```

4. Start development servers:
```bash
# Backend (from backend/)
npm run dev

# Frontend (from frontend/)
npm start
```

## Worker Types

- **Jour** (Day shift)
- **Soir** (Evening shift)
- **Absent**
- **Occasionel du jour** (Occasional day)
- **Occasionel soir** (Occasional evening)
- **Vacances** (Vacation)
- **Liberation externe** (External release)
- **Invalidite** (Invalidity)
- **Preretraite** (Pre-retirement)
- **Conge parental** (Parental leave)

Each type has a unique color for visual identification across the application.
