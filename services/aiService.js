// server/services/aiService.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Make sure GEMINI_API_KEY is set in .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Analyze document text using Google Gemini
 * @param {string} extractedText - Text extracted from OCR
 * @returns {Promise<Object>} - Analyzed document data
 */
async function analyzeDocument(extractedText) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is missing in .env");
      throw new Error("GEMINI_API_KEY not configured");
    }

    console.log("🤖 Starting AI analysis (Gemini)...");
    console.log("📄 Text length:", extractedText.length);

    const prompt = `
You are a document analysis AI. Analyze the following text extracted from a document and extract key information.

IMPORTANT:
- Return ONLY a valid JSON object.
- Do NOT include any explanation, markdown, or extra text.
- All date fields should be in "YYYY-MM-DD" format or null.
- Amount should be a number (no currency symbol) or null.

Extract these fields:
- documentType: one of ["bill", "id", "certificate", "medicine", "insurance", "vehicle", "warranty", "other"]
- category: one of ["Financial", "Government", "Health", "Personal", "Vehicle"]
- dueDate: due date in YYYY-MM-DD format or null
- expiryDate: expiry date in YYYY-MM-DD format or null
- issueDate: issue date in YYYY-MM-DD format or null
- amount: numerical amount if found, or null
- idNumber: any ID/reference number found, or null
- provider: company/issuer name if found, or null
- priority: one of ["HIGH", "MEDIUM", "LOW"] based on urgency
- summary: brief 1-sentence description of the document

Rules for priority:
- HIGH: Due/expiry within 7 days or large amount (>10000)
- MEDIUM: Due/expiry within 30 days or medium amount (1000-10000)
- LOW: Due/expiry beyond 30 days or small amount (<1000)

Document text:
${extractedText}

Return JSON:
`;

    // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // or "gemini-1.5-pro"
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    // if that still 404s, try:
    // const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    // or:
    // const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });


    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    console.log("🤖 AI Response received from Gemini");

    // Parse JSON from response
    let analysisData;
    try {
      // Try to find JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("❌ JSON Parse Error:", parseError.message);
      console.log("Raw response:", responseText);

      // Return default analysis if parsing fails
      analysisData = {
        documentType: "other",
        category: "Personal",
        dueDate: null,
        expiryDate: null,
        issueDate: null,
        amount: null,
        idNumber: null,
        provider: null,
        priority: "MEDIUM",
        summary: "Document uploaded - manual review needed"
      };
    }

    console.log("✅ AI analysis completed:", analysisData.documentType);
    return analysisData;

  } catch (error) {
    console.error("❌ AI Analysis Error (Gemini):", error.message);

    // Return default analysis on error
    return {
      documentType: "other",
      category: "Personal",
      dueDate: null,
      expiryDate: null,
      issueDate: null,
      amount: null,
      idNumber: null,
      provider: null,
      priority: "MEDIUM",
      summary: "Document uploaded - AI analysis failed"
    };
  }
}

/**
 * Calculate priority based on dates and amounts
 * @param {Object} data - Document data
 * @returns {string} - Priority level
 */
function calculatePriority(data) {
  const now = new Date();
  const targetDate = new Date(data.dueDate || data.expiryDate);

  if (!data.dueDate && !data.expiryDate) {
    return "LOW";
  }

  const daysUntil = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));

  // High priority: within 7 days or large amount
  if (daysUntil <= 7 || (data.amount && data.amount > 10000)) {
    return "HIGH";
  }

  // Medium priority: within 30 days or medium amount
  if (daysUntil <= 30 || (data.amount && data.amount > 1000)) {
    return "MEDIUM";
  }

  return "LOW";
}

module.exports = {
  analyzeDocument,
  calculatePriority
};
