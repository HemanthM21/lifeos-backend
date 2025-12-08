// server/controllers/documentController.js

const Document = require('../models/Document');
const Reminder = require('../models/Reminder');
const { extractTextFromImage } = require('../services/ocrService');
const { analyzeDocument, calculatePriority } = require('../services/aiService');
const fs = require('fs');
const path = require('path');

/**
 * @route   POST /api/documents/upload
 * @desc    Upload and analyze document
 * @access  Private
 */
exports.uploadDocument = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    console.log('📤 File uploaded:', req.file.originalname);
    const filePath = req.file.path;

    // STEP 1: Extract text using OCR
    console.log('🔍 Starting OCR...');
    let extractedText;
    try {
      extractedText = await extractTextFromImage(filePath);
      
      if (!extractedText || extractedText.length < 10) {
        throw new Error('Insufficient text extracted from image');
      }
    } catch (ocrError) {
      console.error('OCR failed:', ocrError.message);
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(400).json({
        success: false,
        message: 'Could not extract text from image. Please ensure the image is clear and contains readable text.',
        error: ocrError.message
      });
    }

    // STEP 2: Analyze with AI
    console.log('🤖 Starting AI analysis...');
    let analysis;
    try {
      analysis = await analyzeDocument(extractedText);
    } catch (aiError) {
      console.error('AI Analysis failed:', aiError.message);
      // Continue with default values
      analysis = {
        documentType: 'other',
        category: 'Personal',
        priority: 'MEDIUM',
        summary: 'Document uploaded - analysis incomplete'
      };
    }

    // STEP 3: Save document to database
    const document = new Document({
      user: req.user.id,
      fileName: req.file.originalname,
      fileUrl: filePath,
      documentType: analysis.documentType || 'other',
      category: analysis.category || 'Personal',
      extractedData: {
        dueDate: analysis.dueDate || null,
        expiryDate: analysis.expiryDate || null,
        issueDate: analysis.issueDate || null,
        amount: analysis.amount || null,
        idNumber: analysis.idNumber || null,
        provider: analysis.provider || null,
        rawText: extractedText,
        summary: analysis.summary || 'Document uploaded'
      },
      priority: analysis.priority || 'MEDIUM',
      status: 'ACTIVE'
    });

    await document.save();
    console.log('✅ Document saved to database');

    // STEP 4: Create reminders based on dates
    const reminders = [];
    
    // Create reminder for due date
    if (analysis.dueDate) {
      const dueReminder = new Reminder({
        user: req.user.id,
        document: document._id,
        title: `${analysis.documentType} Payment Due`,
        description: analysis.summary || `${req.file.originalname} payment is due`,
        reminderDate: new Date(analysis.dueDate),
        reminderType: 'DUE_DATE',
        status: 'PENDING'
      });
      await dueReminder.save();
      reminders.push(dueReminder);
      
      // Create advance reminder (7 days before)
      const advanceDate = new Date(analysis.dueDate);
      advanceDate.setDate(advanceDate.getDate() - 7);
      
      if (advanceDate > new Date()) {
        const advanceReminder = new Reminder({
          user: req.user.id,
          document: document._id,
          title: `Upcoming: ${analysis.documentType} Payment`,
          description: `Reminder: ${analysis.summary || req.file.originalname} due in 7 days`,
          reminderDate: advanceDate,
          reminderType: 'DUE_DATE',
          status: 'PENDING'
        });
        await advanceReminder.save();
        reminders.push(advanceReminder);
      }
    }

    // Create reminder for expiry date
    if (analysis.expiryDate) {
      const expiryReminder = new Reminder({
        user: req.user.id,
        document: document._id,
        title: `${analysis.documentType} Expiring Soon`,
        description: analysis.summary || `${req.file.originalname} is expiring`,
        reminderDate: new Date(analysis.expiryDate),
        reminderType: 'EXPIRY',
        status: 'PENDING'
      });
      await expiryReminder.save();
      reminders.push(expiryReminder);

      // Create advance reminder (30 days before expiry)
      const advanceExpiryDate = new Date(analysis.expiryDate);
      advanceExpiryDate.setDate(advanceExpiryDate.getDate() - 30);
      
      if (advanceExpiryDate > new Date()) {
        const advanceExpiryReminder = new Reminder({
          user: req.user.id,
          document: document._id,
          title: `Renewal Reminder: ${analysis.documentType}`,
          description: `${analysis.summary || req.file.originalname} expires in 30 days - consider renewal`,
          reminderDate: advanceExpiryDate,
          reminderType: 'RENEWAL',
          status: 'PENDING'
        });
        await advanceExpiryReminder.save();
        reminders.push(advanceExpiryReminder);
      }
    }

    console.log(`✅ Created ${reminders.length} reminders`);

    // STEP 5: Send response
    res.status(201).json({
      success: true,
      message: 'Document uploaded and analyzed successfully',
      data: {
        document,
        analysis,
        remindersCreated: reminders.length,
        extractedTextLength: extractedText.length
      }
    });

  } catch (error) {
    console.error('❌ Upload Error:', error);
    
    // Clean up uploaded file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Error processing document',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/documents
 * @desc    Get all documents for logged in user
 * @access  Private
 */
exports.getDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ user: req.user.id })
      .sort({ uploadedAt: -1 }); // Most recent first

    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    console.error('Get Documents Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching documents',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/documents/:id
 * @desc    Get single document
 * @access  Private
 */
exports.getDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if document belongs to user
    if (document.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this document'
      });
    }

    res.status(200).json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('Get Document Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching document',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete document
 * @access  Private
 */
exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if document belongs to user
    if (document.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this document'
      });
    }

    // Delete file from filesystem
    if (fs.existsSync(document.fileUrl)) {
      fs.unlinkSync(document.fileUrl);
    }

    // Delete associated reminders
    await Reminder.deleteMany({ document: document._id });

    // Delete document
    await document.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete Document Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting document',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/documents/stats
 * @desc    Get document statistics
 * @access  Private
 */
exports.getStats = async (req, res) => {
  try {
    const totalDocs = await Document.countDocuments({ user: req.user.id });
    
    const byCategory = await Document.aggregate([
      { $match: { user: req.user.mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const byPriority = await Document.aggregate([
      { $match: { user: mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalDocs,
        byCategory,
        byPriority
      }
    });
  } catch (error) {
    console.error('Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};