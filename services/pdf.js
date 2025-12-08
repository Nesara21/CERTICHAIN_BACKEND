const PDFDocument = require('pdfkit');
const { logger } = require('../lib/logger');

/**
 * Generates a deterministic PDF buffer.
 * @param {string} templateType - The type of certificate.
 * @param {object} data - The certificate data.
 * @returns {Promise<Buffer>} - The PDF buffer.
 */
function generatePdfBuffer(templateType, data) {
    return new Promise((resolve, reject) => {
        try {
            // Create a document with a specific creation date to ensure determinism if needed.
            // However, PDFKit puts current timestamp in metadata by default.
            // We can try to override info, but for hash determinism of the *content*, 
            // we usually care about the visible text/images.
            // If strict binary determinism is required, we must mock Date.now or set creationDate.

            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                info: {
                    Title: templateType,
                    Author: 'CertiChain',
                    CreationDate: new Date(0), // Fixed date for determinism
                    ModDate: new Date(0)       // Fixed date for determinism
                }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            doc.on('error', (err) => {
                reject(err);
            });

            // --- Content Generation ---
            // This is a simplified generic template. In a real app, you'd have specific layouts.

            // Header
            doc.fontSize(25).text(data.institute_name || 'Institute Name', { align: 'center' });
            doc.moveDown();

            // Title
            doc.fontSize(20).text(templateType, { align: 'center', underline: true });
            doc.moveDown(2);

            // Body
            doc.fontSize(14).text(`This is to certify that`, { align: 'center' });
            doc.moveDown(0.5);

            doc.fontSize(18).font('Helvetica-Bold').text(data.student_name || 'Student Name', { align: 'center' });
            doc.fontSize(14).font('Helvetica').text(`(USN: ${data.student_usn || 'N/A'})`, { align: 'center' });
            doc.moveDown(1);

            doc.text(`Has successfully completed the requirements for:`, { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(16).font('Helvetica-Bold').text(data.program_name || 'Program Name', { align: 'center' });
            doc.moveDown(2);

            // Details
            doc.fontSize(12).font('Helvetica');
            if (data.issue_date) doc.text(`Date of Issue: ${data.issue_date}`, { align: 'left' });
            if (data.request_id) doc.text(`Certificate ID: CERT-${data.request_id}`, { align: 'left' });

            // Footer
            doc.moveDown(4);
            doc.text('Authorized Signatory', { align: 'right' });

            doc.end();

        } catch (err) {
            logger.error(`PDF Generation failed: ${err.message}`);
            reject(err);
        }
    });
}

module.exports = { generatePdfBuffer };
