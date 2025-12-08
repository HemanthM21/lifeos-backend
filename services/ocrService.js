// server/services/ocrService.js

const Tesseract = require("tesseract.js");
const fs = require("fs");

/**
 * Extract text from image using Tesseract OCR
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromImage(imagePath) {
  try {
    console.log("🔍 Starting OCR on:", imagePath);

    // Make sure file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error("Image file not found at path: " + imagePath);
    }

    // Run OCR
    const result = await Tesseract.recognize(imagePath, "eng", {
      logger: (info) => {
        if (info.status === "recognizing text") {
          console.log(`OCR Progress: ${Math.round(info.progress * 100)}%`);
        }
      },
    });

    const text = result.data.text || "";
    
    console.log("✅ OCR completed successfully");
    console.log("📝 Extracted text length:", text.length);

    // Clean extracted text
    const cleanedText = text.replace(/\s+/g, " ").trim();

    if (!cleanedText) {
      console.warn("⚠️ OCR returned empty text — low-quality image?");
    }

    return cleanedText;

  } catch (error) {
    console.error("❌ OCR Error:", error.message);
    throw new Error("Failed to extract text from image: " + error.message);
  }
}

module.exports = { extractTextFromImage };
