const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const fs = require("fs").promises;
const logger = require("../config/logger");

async function extractTextFromPDF(filePath) {
  try {
    if (!filePath) {
      throw new Error("File path is required");
    }

    logger.info(`Extracting text from PDF: ${filePath}`);

    const fileBuffer = await fs.readFile(filePath);

    if (fileBuffer.length === 0) {
      throw new Error("PDF file is empty");
    }

    try {
      const pdfData = await pdfParse(fileBuffer, {
        max: 0,
      });

      const fullText = pdfData.text;
      logger.info(`Successfully extracted ${fullText.length} characters from PDF`);

      return {
        text: fullText,
        pages: pdfData.numpages,
        version: pdfData.version,
        length: fullText.length,
        method: "primary",
      };
    } catch (primaryError) {
      logger.warn(`Primary PDF extraction failed: ${primaryError.message}`);
      logger.info("Attempting fallback extraction methods...");

      try {
        const pdfData = await pdfParse(fileBuffer, {
          max: 0,
          version: "default",
        });

        if (pdfData.text && pdfData.text.length > 0) {
          logger.info(`Fallback extraction successful: ${pdfData.text.length} characters`);
          return {
            text: pdfData.text,
            pages: pdfData.numpages || 1,
            version: "fallback",
            length: pdfData.text.length,
            method: "fallback",
          };
        }
      } catch (fallbackError) {
        logger.warn(`Fallback extraction also failed: ${fallbackError.message}`);
      }

      // FALLBACK 2: Extract raw text if possible
      const rawText = fileBuffer.toString("utf8", 0, Math.min(fileBuffer.length, 50000));
      const cleanedRawText = rawText
        .replace(/[^\x20-\x7E\n\r]/g, " ") // Remove non-printable chars
        .replace(/\s+/g, " ")
        .trim();

      if (cleanedRawText.length > 100) {
        logger.warn("Using raw text extraction (last resort)");
        return {
          text: cleanedRawText,
          pages: 1,
          version: "raw",
          length: cleanedRawText.length,
          method: "raw",
          warning: "PDF structure damaged, used raw text extraction",
        };
      }

      throw new Error(`PDF extraction failed: ${primaryError.message}. The PDF may be corrupted, password-protected, or in an unsupported format.`);
    }
  } catch (error) {
    logger.error(`Error extracting PDF text: ${error.message}`);
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

async function extractAndCleanPDF(filePath) {
  try {
    const extraction = await extractTextFromPDF(filePath);
    const {text, pages, method, warning} = extraction;

    const cleanedText = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n");

    logger.info(`Cleaned text: ${cleanedText.length} characters, ${pages} pages (method: ${method})`);

    if (warning) {
      logger.warn(warning);
    }

    return {
      text: cleanedText,
      originalLength: text.length,
      cleanedLength: cleanedText.length,
      pages,
      method,
      warning,
    };
  } catch (error) {
    logger.error(`Error cleaning PDF: ${error.message}`);
    throw error;
  }
}

async function extractPDFSummary(filePath, maxLength = 1000) {
  try {
    const {text} = await extractTextFromPDF(filePath);

    const summary = text.substring(0, maxLength);

    return {
      summary,
      isTruncated: text.length > maxLength,
      totalLength: text.length,
    };
  } catch (error) {
    logger.error(`Error extracting PDF summary: ${error.message}`);
    throw error;
  }
}

async function extractAndChunkPDF(filePath, chunkSize = 500) {
  try {
    const {text} = await extractTextFromPDF(filePath);

    const chunks = [];
    const overlap = Math.floor(chunkSize * 0.1);

    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push(text.substring(i, i + chunkSize));
    }

    logger.info(`Created ${chunks.length} chunks from PDF`);

    return {
      chunks,
      totalChunks: chunks.length,
      chunkSize,
      overlap,
    };
  } catch (error) {
    logger.error(`Error chunking PDF: ${error.message}`);
    throw error;
  }
}

async function validatePDF(filePath) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const header = fileBuffer.toString("utf8", 0, 5);
    if (!header.startsWith("%PDF")) {
      throw new Error("File does not appear to be a valid PDF (missing %PDF header)");
    }

    if (fileBuffer.length < 100) {
      throw new Error("PDF file is too small or corrupted");
    }

    try {
      const extraction = await extractTextFromPDF(filePath);
      if (extraction.text.length < 10) {
        logger.warn("PDF has very little extractable text (might be scanned/images)");
      }
    } catch (error) {
      logger.warn(`PDF validation warning: ${error.message}`);
    }

    logger.info(`PDF validation passed: ${fileBuffer.length} bytes`);

    return {
      valid: true,
      size: fileBuffer.length,
      header,
    };
  } catch (error) {
    logger.error(`PDF validation failed: ${error.message}`);
    return {
      valid: false,
      error: error.message,
    };
  }
}

async function isPDFReadable(filePath) {
  try {
    const extraction = await extractTextFromPDF(filePath);

    if (extraction.text.length >= 50) {
      return {
        readable: true,
        textLength: extraction.text.length,
        pages: extraction.pages,
        method: extraction.method,
      };
    }

    return {
      readable: false,
      reason: "Extracted text too short (possible scanned/image PDF)",
      textLength: extraction.text.length,
    };
  } catch (error) {
    return {
      readable: false,
      reason: error.message,
      error: true,
    };
  }
}

async function attemptPDFRepair(filePath) {
  try {
    logger.info("Attempting PDF repair...");

    const fileBuffer = await fs.readFile(filePath);

    const text = fileBuffer.toString("latin1");
    const streamMatches = text.match(/stream([\s\S]*?)endstream/g);

    if (streamMatches && streamMatches.length > 0) {
      let extractedText = "";

      streamMatches.forEach((match) => {
        // Extract printable characters
        const cleaned = match
          .replace(/stream|endstream/g, "")
          .replace(/[^\x20-\x7E\n]/g, " ")
          .trim();

        if (cleaned.length > 20) {
          extractedText += cleaned + "\n";
        }
      });

      if (extractedText.length > 100) {
        logger.info(`Repair successful: extracted ${extractedText.length} characters`);
        return {
          success: true,
          text: extractedText,
          method: "stream_extraction",
        };
      }
    }

    return {
      success: false,
      reason: "No recoverable text found",
    };
  } catch (error) {
    logger.error(`PDF repair failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  extractTextFromPDF,
  extractAndCleanPDF,
  extractPDFSummary,
  extractAndChunkPDF,
  validatePDF,
  isPDFReadable,
  attemptPDFRepair,
};
