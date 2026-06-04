const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract text content from uploaded files.
 * Supports PDF (via pdf-parse) and DOCX (via mammoth).
 *
 * @param {string} filePath - Absolute or relative path to the uploaded file
 * @param {string} mimetype - MIME type of the file
 * @returns {Promise<string>} Extracted text content
 */
const extractText = async (filePath, mimetype) => {
  try {
    // Handle PDF files
    if (mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      return pdfData.text || '';
    }

    // Handle DOCX files
    if (
      mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    }

    throw new Error(`Unsupported file type: ${mimetype}`);
  } catch (error) {
    console.error(`❌ Text extraction failed for ${filePath}:`, error.message);
    throw new Error(`Failed to extract text from file: ${error.message}`);
  }
};

module.exports = { extractText };
