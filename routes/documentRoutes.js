// server/routes/documentRoutes.js

const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload'); // ✅ Use the global upload middleware

const {
  uploadDocument,
  getDocuments,
  getDocument,
  deleteDocument,
  getStats
} = require('../controllers/documentController');

// ============================================
// ROUTES
// ============================================

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/documents/upload
 * @desc    Upload and analyze document
 * @access  Private
 */
router.post('/upload', upload.single('file'), uploadDocument);
// 🔥 FIXED: field name MUST be "file"

/**
 * @route   GET /api/documents
 * @desc    Get all documents for logged in user
 * @access  Private
 */
router.get('/', getDocuments);

/**
 * @route   GET /api/documents/stats
 * @desc    Get document statistics
 * @access  Private
 */
router.get('/stats', getStats);

/**
 * @route   GET /api/documents/:id
 * @desc    Get single document by ID
 * @access  Private
 */
router.get('/:id', getDocument);

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete document
 * @access  Private
 */
router.delete('/:id', deleteDocument);

module.exports = router;
