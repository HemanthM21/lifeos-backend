// server/controllers/reminderController.js

const Reminder = require('../models/Reminder');
const Document = require('../models/Document');
const mongoose = require('mongoose');

/**
 * @route   GET /api/reminders
 * @desc    Get all reminders for logged in user
 * @access  Private
 */
exports.getReminders = async (req, res) => {
  try {
    const { status, type } = req.query;
    
    // Build query
    const query = { user: req.user.id };
    
    // Filter by status if provided (PENDING, COMPLETED, DISMISSED)
    if (status) {
      query.status = status.toUpperCase();
    }
    
    // Filter by reminder type if provided
    if (type) {
      query.reminderType = type.toUpperCase();
    }

    const reminders = await Reminder.find(query)
      .populate('document', 'fileName documentType category priority extractedData')
      .sort({ reminderDate: 1 }); // Sort by date - earliest first

    res.status(200).json({
      success: true,
      count: reminders.length,
      data: reminders
    });

  } catch (error) {
    console.error('❌ Get Reminders Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reminders',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/reminders/upcoming
 * @desc    Get upcoming reminders (next 30 days)
 * @access  Private
 */
exports.getUpcomingReminders = async (req, res) => {
  try {
    const now = new Date();
    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);

    const reminders = await Reminder.find({
      user: req.user.id,
      status: 'PENDING',
      reminderDate: {
        $gte: now,
        $lte: next30Days
      }
    })
    .populate('document', 'fileName documentType category priority extractedData')
    .sort({ reminderDate: 1 })
    .lean(); // Convert to plain JavaScript objects for better performance

    // Add additional computed fields
    const enrichedReminders = reminders.map(reminder => {
      const daysUntil = Math.ceil(
        (new Date(reminder.reminderDate) - now) / (1000 * 60 * 60 * 24)
      );
      
      return {
        ...reminder,
        daysUntil,
        isUrgent: daysUntil <= 3,
        isOverdue: daysUntil < 0
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedReminders.length,
      data: enrichedReminders
    });

  } catch (error) {
    console.error('❌ Get Upcoming Reminders Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching upcoming reminders',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/reminders/overdue
 * @desc    Get overdue reminders
 * @access  Private
 */
exports.getOverdueReminders = async (req, res) => {
  try {
    const now = new Date();

    const reminders = await Reminder.find({
      user: req.user.id,
      status: 'PENDING',
      reminderDate: { $lt: now }
    })
    .populate('document', 'fileName documentType category priority')
    .sort({ reminderDate: 1 });

    res.status(200).json({
      success: true,
      count: reminders.length,
      data: reminders
    });

  } catch (error) {
    console.error('❌ Get Overdue Reminders Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching overdue reminders',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/reminders/today
 * @desc    Get today's reminders
 * @access  Private
 */
exports.getTodayReminders = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const reminders = await Reminder.find({
      user: req.user.id,
      status: 'PENDING',
      reminderDate: {
        $gte: today,
        $lt: tomorrow
      }
    })
    .populate('document', 'fileName documentType category priority')
    .sort({ reminderDate: 1 });

    res.status(200).json({
      success: true,
      count: reminders.length,
      data: reminders
    });

  } catch (error) {
    console.error('❌ Get Today Reminders Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today\'s reminders',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/reminders/:id
 * @desc    Get single reminder by ID
 * @access  Private
 */
exports.getReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id)
      .populate('document');

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Check if reminder belongs to user
    if (reminder.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this reminder'
      });
    }

    res.status(200).json({
      success: true,
      data: reminder
    });

  } catch (error) {
    console.error('❌ Get Reminder Error:', error);
    
    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error fetching reminder',
      error: error.message
    });
  }
};

/**
 * @route   PATCH /api/reminders/:id/complete
 * @desc    Mark reminder as completed
 * @access  Private
 */
exports.completeReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Check if reminder belongs to user
    if (reminder.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this reminder'
      });
    }

    // Update status
    reminder.status = 'COMPLETED';
    await reminder.save();

    console.log('✅ Reminder marked as completed:', reminder._id);

    res.status(200).json({
      success: true,
      message: 'Reminder marked as completed',
      data: reminder
    });

  } catch (error) {
    console.error('❌ Complete Reminder Error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error completing reminder',
      error: error.message
    });
  }
};

/**
 * @route   PATCH /api/reminders/:id/dismiss
 * @desc    Dismiss reminder
 * @access  Private
 */
exports.dismissReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Check if reminder belongs to user
    if (reminder.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this reminder'
      });
    }

    // Update status
    reminder.status = 'DISMISSED';
    await reminder.save();

    console.log('✅ Reminder dismissed:', reminder._id);

    res.status(200).json({
      success: true,
      message: 'Reminder dismissed',
      data: reminder
    });

  } catch (error) {
    console.error('❌ Dismiss Reminder Error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error dismissing reminder',
      error: error.message
    });
  }
};

/**
 * @route   PATCH /api/reminders/:id/snooze
 * @desc    Snooze reminder (postpone by specified days)
 * @access  Private
 */
exports.snoozeReminder = async (req, res) => {
  try {
    const { days = 1 } = req.body; // Default snooze 1 day

    const reminder = await Reminder.findById(req.params.id);

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Check if reminder belongs to user
    if (reminder.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this reminder'
      });
    }

    // Update reminder date
    const newDate = new Date(reminder.reminderDate);
    newDate.setDate(newDate.getDate() + parseInt(days));
    
    reminder.reminderDate = newDate;
    reminder.status = 'PENDING'; // Reset to pending if it was dismissed
    await reminder.save();

    console.log(`✅ Reminder snoozed by ${days} day(s):`, reminder._id);

    res.status(200).json({
      success: true,
      message: `Reminder snoozed by ${days} day(s)`,
      data: reminder
    });

  } catch (error) {
    console.error('❌ Snooze Reminder Error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error snoozing reminder',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/reminders/:id
 * @desc    Delete reminder permanently
 * @access  Private
 */
exports.deleteReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Check if reminder belongs to user
    if (reminder.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this reminder'
      });
    }

    await reminder.deleteOne();

    console.log('✅ Reminder deleted:', req.params.id);

    res.status(200).json({
      success: true,
      message: 'Reminder deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete Reminder Error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error deleting reminder',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/reminders/stats
 * @desc    Get reminder statistics
 * @access  Private
 */
exports.getReminderStats = async (req, res) => {
  try {
    const userId = mongoose.Types.ObjectId(req.user.id);

    // Count by status
    const totalReminders = await Reminder.countDocuments({ user: userId });
    const pendingReminders = await Reminder.countDocuments({ 
      user: userId, 
      status: 'PENDING' 
    });
    const completedReminders = await Reminder.countDocuments({ 
      user: userId, 
      status: 'COMPLETED' 
    });
    const dismissedReminders = await Reminder.countDocuments({ 
      user: userId, 
      status: 'DISMISSED' 
    });

    // Count overdue
    const now = new Date();
    const overdueReminders = await Reminder.countDocuments({
      user: userId,
      status: 'PENDING',
      reminderDate: { $lt: now }
    });

    // Count upcoming (next 7 days)
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);
    const upcomingReminders = await Reminder.countDocuments({
      user: userId,
      status: 'PENDING',
      reminderDate: {
        $gte: now,
        $lte: next7Days
      }
    });

    // Group by type
    const byType = await Reminder.aggregate([
      { $match: { user: userId } },
      { 
        $group: { 
          _id: '$reminderType', 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalReminders,
        pending: pendingReminders,
        completed: completedReminders,
        dismissed: dismissedReminders,
        overdue: overdueReminders,
        upcoming: upcomingReminders,
        byType: byType
      }
    });

  } catch (error) {
    console.error('❌ Get Reminder Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reminder statistics',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/reminders/bulk-delete
 * @desc    Delete multiple reminders
 * @access  Private
 */
exports.bulkDeleteReminders = async (req, res) => {
  try {
    const { reminderIds } = req.body;

    if (!reminderIds || !Array.isArray(reminderIds) || reminderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of reminder IDs'
      });
    }

    // Delete only reminders that belong to the user
    const result = await Reminder.deleteMany({
      _id: { $in: reminderIds },
      user: req.user.id
    });

    console.log(`✅ Bulk deleted ${result.deletedCount} reminders`);

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} reminder(s) deleted successfully`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('❌ Bulk Delete Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting reminders',
      error: error.message
    });
  }
};

/**
 * @route   PATCH /api/reminders/bulk-complete
 * @desc    Mark multiple reminders as completed
 * @access  Private
 */
exports.bulkCompleteReminders = async (req, res) => {
  try {
    const { reminderIds } = req.body;

    if (!reminderIds || !Array.isArray(reminderIds) || reminderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of reminder IDs'
      });
    }

    // Update only reminders that belong to the user
    const result = await Reminder.updateMany(
      {
        _id: { $in: reminderIds },
        user: req.user.id
      },
      {
        $set: { status: 'COMPLETED' }
      }
    );

    console.log(`✅ Bulk completed ${result.modifiedCount} reminders`);

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} reminder(s) marked as completed`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('❌ Bulk Complete Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing reminders',
      error: error.message
    });
  }
};

module.exports = exports;