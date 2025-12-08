// server/routes/reminderRoutes.js

const express = require('express');
const router = express.Router();
const {
  getReminders,
  getUpcomingReminders,
  getOverdueReminders,
  getTodayReminders,
  getReminder,
  completeReminder,
  dismissReminder,
  snoozeReminder,
  deleteReminder,
  getReminderStats,
  bulkDeleteReminders,
  bulkCompleteReminders
} = require('../controllers/reminderController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// GET routes
router.get('/', getReminders);                    // Get all reminders (with optional filters)
router.get('/upcoming', getUpcomingReminders);    // Get upcoming reminders (next 30 days)
router.get('/overdue', getOverdueReminders);      // Get overdue reminders
router.get('/today', getTodayReminders);          // Get today's reminders
router.get('/stats', getReminderStats);           // Get reminder statistics
router.get('/:id', getReminder);                  // Get single reminder

// PATCH routes (update)
router.patch('/:id/complete', completeReminder);  // Mark as completed
router.patch('/:id/dismiss', dismissReminder);    // Dismiss reminder
router.patch('/:id/snooze', snoozeReminder);      // Snooze reminder

// DELETE routes
router.delete('/:id', deleteReminder);            // Delete single reminder

// Bulk operations
router.delete('/bulk/delete', bulkDeleteReminders);     // Bulk delete
router.patch('/bulk/complete', bulkCompleteReminders);  // Bulk complete

module.exports = router;