import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import workerRoutes from './routes/workers';
import postRoutes from './routes/posts';
import assignmentRoutes from './routes/assignments';
import planRoutes from './routes/plans';
import exportRoutes from './routes/export';
import authRoutes from './routes/auth';
import healthRoutes from './routes/health';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/export', exportRoutes);

// Socket.io for real-time collaboration
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
  });

  socket.on('worker-assigned', async (data) => {
    // Broadcast to all users in the same room
    socket.to(data.room).emit('worker-assigned', data);
  });

  socket.on('worker-type-changed', async (data) => {
    socket.to(data.room).emit('worker-type-changed', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export { io, prisma };
