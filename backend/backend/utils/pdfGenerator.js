// /utils/pdfGenerator.js
// Puppeteer-based HTML → PDF converter

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Converts an HTML string or file path to a PDF.
 *
 * @param {string} htmlContent  - Raw HTML string (preferred) or file path string
 * @param {string} outputPath   - Full output path for the PDF (e.g. /tmp/cert.pdf)
 * @param {object} pdfOptions   - Additional Puppeteer PDF options override
 * @returns {Promise<Buffer>}   - PDF buffer (also saved to outputPath if provided)
 */
async function htmlToPdf(htmlContent, outputPath = null, pdfOptions = {}) {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    });

    const page = await browser.newPage();

    // Set viewport to A4 landscape dimensions (approx 1123x794 px at 96dpi)
    await page.setViewport({
      width: 1123,
      height: 794,
      deviceScaleFactor: 2, // 2x for high resolution
    });

    // Determine if input is a file path or raw HTML
    if (htmlContent.trim().startsWith('<') || htmlContent.trim().startsWith('<!')) {
      // Raw HTML string
      await page.setContent(htmlContent, {
        waitUntil: ['load', 'networkidle0'], // Wait for everything including images
        timeout: 60000, // Increased timeout for images
      });
    } else if (fs.existsSync(htmlContent)) {
      // File path
      await page.goto(`file://${path.resolve(htmlContent)}`, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
    } else {
      throw new Error('htmlContent must be valid HTML string or existing file path');
    }

    // Wait extra for fonts and layout rendering
    await page.evaluate(() => document.fonts.ready);
    await new Promise(resolve => setTimeout(resolve, 800));

    // PDF generation settings
    const pdfConfig = {
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      preferCSSPageSize: false,
      ...pdfOptions,
    };

    const pdfBuffer = await page.pdf(pdfConfig);

    // Save to disk if outputPath provided
    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, pdfBuffer);
    }

    return pdfBuffer;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Convert HTML to PDF and return as Buffer (for streaming downloads).
 * @param {string} htmlContent
 * @returns {Promise<Buffer>}
 */
async function htmlToPdfBuffer(htmlContent) {
  return htmlToPdf(htmlContent, null);
}

/**
 * Merge multiple PDFs into a single zip-ready array of buffers.
 * (Actual zip creation is done in controller using archiver)
 * @param {Array<{htmlContent: string, filename: string}>} items
 * @returns {Promise<Array<{buffer: Buffer, filename: string}>>}
 */
async function generatePdfBatch(items) {
  const results = [];
  for (const item of items) {
    const buffer = await htmlToPdfBuffer(item.htmlContent);
    results.push({ buffer, filename: item.filename });
  }
  return results;
}

module.exports = { htmlToPdf, htmlToPdfBuffer, generatePdfBatch };