require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { authMiddleware, adminOnly } = require('./middleware/auth');
const employeesRouter = require('./routes/employees');
const shiftsRouter = require('./routes/shifts');
const templatesRouter = require('./routes/templates');
const notificationsRouter = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS — allow frontend origin
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// All routes require auth
app.use('/api/employees', authMiddleware, employeesRouter);
app.use('/api/shifts', authMiddleware, shiftsRouter);
app.use('/api/templates', authMiddleware, templatesRouter);
app.use('/api/notifications', authMiddleware, notificationsRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Tushita Backend running on port ${PORT}`);
});
