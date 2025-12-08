// server/models/Reminder.js

const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  document: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  reminderDate: {
    type: Date,
    required: true
  },
  reminderType: {
    type: String,
    enum: ['DUE_DATE', 'EXPIRY', 'RENEWAL', 'PAYMENT', 'OTHER'],
    default: 'OTHER'
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'DISMISSED'],
    default: 'PENDING'
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
reminderSchema.index({ user: 1, reminderDate: 1 });
reminderSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);