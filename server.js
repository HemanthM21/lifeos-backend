// server/server.js

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');
const fs = require('fs');

dotenv.config();
connectDB();

const app = express();

// ============================================
// CREATE UPLOADS DIRECTORY IF NOT EXISTS
// ============================================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log('✅ Created uploads directory');
}

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ============================================
// AI TEST ROUTE
// ============================================
const { analyzeDocument, calculatePriority } = require('./services/aiService');

app.post('/api/test/ai', async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide "text" in JSON body'
      });
    }

    const analysis = await analyzeDocument(text);
    const priority = calculatePriority(analysis);

    res.status(200).json({ success: true, analysis, priority });

  } catch (err) {
    next(err);
  }
});

// ============================================
// OCR TEST ROUTE (MUST BE BEFORE MAIN ROUTES)
// ============================================
const upload = require('./middleware/upload');
const { extractTextFromImage } = require('./services/ocrService');

app.post('/api/test/ocr', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image with field name "file"',
      });
    }

    const extractedText = await extractTextFromImage(req.file.path);

    res.status(200).json({
      success: true,
      extractedText,
    });

  } catch (err) {
    console.error("OCR Test Error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ============================================
// MAIN API ROUTES (AFTER TEST ROUTES)
// ============================================
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/reminders', require('./routes/reminderRoutes'));

// ============================================
// ROOT ROUTE
// ============================================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 LifeOS API is running!',
    version: '1.0.0',
  });
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// 404 HANDLER — MUST BE LAST
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`
  });
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   🚀 LifeOS Server Running           
║   📍 Port: ${PORT}                     
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}
║   📡 API URL: http://localhost:${PORT}
╚═══════════════════════════════════════╝
  `);
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => console.log('✅ Process terminated'));
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});
