/**
 * PDF Export Service for Access Requests
 * Generates professional PDF documents with company branding
 */

import { Company, Employee, AccessRequest, CompanyPackage, FormationPackage } from '../models/index.js';

/**
 * Generate a professional PDF for access requests
 * @param {Array} requests - Array of access requests
 * @param {Object} company - Company object
 * @returns {Promise<Buffer>} - PDF buffer
 */
export async function generateAccessRequestsPDF(requests, company) {
  // Dynamic import for pdfkit (lazy load)
  const PDFDocument = (await import('pdfkit')).default;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: 'Demandes d\'accès - ' + company.name,
          Author: 'StudiesHolding',
          Subject: 'Rapport des demandes d\'accès'
        }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Colors
      const primaryColor = '#2563EB'; // Blue
      const textColor = '#1F2937'; // Dark gray
      const lightGray = '#F3F4F6';
      const borderColor = '#E5E7EB';
      
      // Header
      doc.rect(0, 0, doc.page.width, 120).fill('#FFFFFF');
      doc.fillColor(primaryColor).fontSize(24).text('StudiesHolding', 50, 30);
      doc.fillColor(textColor).fontSize(12).text('Plateforme de Formation Enterprise', 50, 58);
      
      // Company info
      doc.fontSize(10).fillColor('#6B7280').text(company.name, 50, 75);
      doc.text(company.email || '', 50, 88);
      
      // Report title
      doc.rect(0, 120, doc.page.width, 50).fill(lightGray);
      doc.fillColor(textColor).fontSize(16).text('Rapport des demandes d\'accès', 50, 135);
      doc.fontSize(10).fillColor('#6B7280').text(`Généré le: ${new Date().toLocaleDateString('fr-FR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, 50, 155);
      doc.text(`Total des demandes: ${requests.length}`, 50, 168);
      
      // Table header
      let yPos = 200;
      doc.rect(50, yPos, doc.page.width - 100, 25).fill(primaryColor);
      doc.fillColor('#FFFFFF').fontSize(9).text('Collaborateur', 55, yPos + 8);
      doc.text('Email', 160, yPos + 8);
      doc.text('Package', 280, yPos + 8);
      doc.text('Statut', 420, yPos + 8);
      doc.text('Date', 500, yPos + 8);
      
      // Table rows
      yPos += 30;
      doc.fillColor(textColor).fontSize(9);
      
      requests.forEach((req, index) => {
        // Alternate row colors
        if (index % 2 === 0) {
          doc.rect(50, yPos - 5, doc.page.width - 100, 20).fill('#F9FAFB');
        }
        
        const employee = req.employee || {};
        const packageInfo = req.companyPackage?.package || {};
        
        doc.fillColor(textColor);
        doc.text(`${employee.first_name || ''} ${employee.last_name || ''}`.trim(), 55, yPos);
        doc.text(employee.email || '-', 160, yPos);
        doc.text(packageInfo.title || req.package || '-', 280, yPos);
        
        // Status with color
        const statusColors = {
          'pending': '#F59E0B',
          'processing': '#3B82F6',
          'activated': '#10B981',
          'rejected': '#EF4444'
        };
        doc.fillColor(statusColors[req.status] || '#6B7280').text(req.status.toUpperCase(), 420, yPos);
        
        doc.fillColor('#6B7280').text(req.created_at ? new Date(req.created_at).toLocaleDateString('fr-FR') : '-', 500, yPos);
        
        yPos += 20;
        
        // New page if needed
        if (yPos > 750) {
          doc.addPage();
          yPos = 50;
        }
      });
      
      // Summary section
      yPos += 20;
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }
      
      doc.rect(50, yPos, doc.page.width - 100, 80).fill(lightGray).stroke(borderColor);
      doc.fillColor(textColor).fontSize(12).text('Résumé', 60, yPos + 10);
      
      const statusCounts = {};
      requests.forEach(req => {
        statusCounts[req.status] = (statusCounts[req.status] || 0) + 1;
      });
      
      doc.fontSize(10);
      let summaryY = yPos + 30;
      Object.entries(statusCounts).forEach(([status, count]) => {
        doc.fillColor(textColor).text(`${status}: ${count}`, 60, summaryY);
        summaryY += 15;
      });
      
      // Footer
      const pageHeight = doc.page.height;
      doc.rect(0, pageHeight - 40, doc.page.width, 40).fill('#F9FAFB');
      doc.fillColor('#9CA3AF').fontSize(8).text(
        'Ce document a été généré automatiquement par StudiesHolding. Pour toute question, contactez-nous à contact@studiesholding.com',
        50,
        pageHeight - 25,
        { align: 'center', width: doc.page.width - 100 }
      );
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate invoice PDF for an order
 * @param {Object} order - Order object
 * @param {Object} company - Company object
 * @returns {Promise<Buffer>} - PDF buffer
 */
export async function generateInvoicePDF(order, company) {
  const PDFDocument = (await import('pdfkit')).default;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Facture ${order.reference}`,
          Author: 'StudiesHolding',
          Subject: 'Facture'
        }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      const primaryColor = '#2563EB';
      const textColor = '#1F2937';
      
      // Header with company branding
      doc.rect(0, 0, doc.page.width, 100).fill('#FFFFFF');
      doc.fillColor(primaryColor).fontSize(28).text('StudiesHolding', 50, 25);
      doc.fontSize(10).fillColor('#6B7280').text('Plateforme de Formation Enterprise', 50, 55);
      doc.text('contact@studiesholding.com', 50, 70);
      
      // Invoice title
      doc.fillColor(textColor).fontSize(24).text('FACTURE', 400, 30);
      doc.fontSize(10).text(`N°: ${order.reference}`, 400, 58);
      doc.fillColor('#6B7280').text(`Date: ${new Date(order.created_at || new Date()).toLocaleDateString('fr-FR')}`, 400, 73);
      
      // Company details
      const companyY = 130;
      doc.rect(50, companyY, 200, 80).fill('#F9FAFB').stroke('#E5E7EB');
      doc.fillColor(textColor).fontSize(10).text('Émetteur:', 60, companyY + 10);
      doc.fillColor('#6B7280').fontSize(9).text('StudiesHolding', 60, companyY + 25)
         .text('contact@studiesholding.com', 60, companyY + 38)
         .text('Cameroun', 60, companyY + 51);
      
      // Client details
      doc.rect(280, companyY, 270, 80).fill('#F9FAFB').stroke('#E5E7EB');
      doc.fillColor(textColor).fontSize(10).text('Client:', 290, companyY + 10);
      doc.fillColor('#6B7280').fontSize(9).text(company.name, 290, companyY + 25)
         .text(company.email || '', 290, companyY + 38)
         .text('Entreprise', 290, companyY + 51);
      
      // Invoice items
      const tableY = 250;
      doc.rect(50, tableY, doc.page.width - 100, 25).fill(primaryColor);
      doc.fillColor('#FFFFFF').fontSize(9).text('Description', 55, tableY + 8)
         .text('Quantité', 350, tableY + 8)
         .text('Prix unitaire', 420, tableY + 8)
         .text('Total', 520, tableY + 8);
      
      // Item row
      const itemY = tableY + 30;
      const metadata = typeof order.metadata === 'string' ? JSON.parse(order.metadata) : order.metadata;
      const quantity = metadata?.licence_count || metadata?.total_licenses || 1;
      const unitPrice = metadata?.unit_price || metadata?.backendUnitPrice || order.total_amount || 0;
      
      doc.fillColor(textColor).fontSize(10);
      doc.text('Formation - ' + (order.formationName || metadata?.packageName || 'Package Formation'), 55, itemY);
      doc.text(quantity.toString(), 350, itemY);
      doc.text(unitPrice.toLocaleString('fr-FR') + ' ' + (order.currency || '€'), 420, itemY);
      doc.text(order.total_amount?.toLocaleString('fr-FR') || '0 ' + (order.currency || '€'), 520, itemY);
      
      // Total
      doc.rect(400, itemY + 30, 200, 30).fill('#F3F4F6').stroke('#E5E7EB');
      doc.fillColor(textColor).fontSize(12).text('Total:', 410, itemY + 40);
      doc.fontSize(14).text((order.total_amount || 0).toLocaleString('fr-FR') + ' ' + (order.currency || '€'), 480, itemY + 38);
      
      // Payment status
      const statusY = itemY + 80;
      doc.fillColor(textColor).fontSize(10).text('Statut du paiement:', 50, statusY);
      const statusColor = order.status === 'validated' || order.status === 'paid' ? '#10B981' : '#F59E0B';
      doc.fillColor(statusColor).text(order.status.toUpperCase(), 160, statusY);
      
      // Footer
      const pageHeight = doc.page.height;
      doc.rect(0, pageHeight - 50, doc.page.width, 50).fill('#F9FAFB');
      doc.fillColor('#9CA3AF').fontSize(8).text(
        'Merci pour votre confiance. Cette facture a été générée automatiquement par StudiesHolding.',
        50,
        pageHeight - 30,
        { align: 'center', width: doc.page.width - 100 }
      );
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export default {
  generateAccessRequestsPDF,
  generateInvoicePDF
};
