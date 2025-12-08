// server/models/Document.js

const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  documentType: {
    type: String,
    enum: ['bill', 'id', 'certificate', 'medicine', 'insurance', 'vehicle', 'warranty', 'other'],
    default: 'other'
  },
  category: {
    type: String,
    enum: ['Financial', 'Government', 'Health', 'Personal', 'Vehicle'],
    default: 'Personal'
  },
  extractedData: {
    dueDate: Date,
    expiryDate: Date,
    issueDate: Date,
    amount: Number,
    idNumber: String,
    provider: String,
    rawText: String,
    summary: String
  },
  priority: {
    type: String,
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'COMPLETED'],
    default: 'ACTIVE'
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
documentSchema.index({ user: 1, uploadedAt: -1 });
documentSchema.index({ user: 1, priority: 1 });

module.exports = mongoose.model('Document', documentSchema);