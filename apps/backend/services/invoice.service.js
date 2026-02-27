import puppeteer from "puppeteer";
import fs from "fs";

/**
 * Service to generate professional PDF invoices
 */
export class InvoiceService {
    /**
     * Generate a PDF invoice for a payment intent
     * Returns null if Puppeteer is not available
     * @param {Object} intent
     * @param {Object} order
     * @returns {Promise<Buffer|null>}
     */
    static async generateInvoiceBuffer(intent, order) {
        let browser;
        try {
            // Auto-detection of browser to avoid "not found" errors
            // USER REQUEST: Prioritize chromium-browser for VPS compatibility
            const possiblePaths = [
                process.env.PUPPETEER_EXECUTABLE_PATH,
                "/usr/bin/chromium-browser",
                "/usr/bin/google-chrome",
                "/usr/bin/google-chrome-stable",
                "/usr/bin/chromium",
            ].filter(Boolean);

            let executablePath = possiblePaths.find(path => fs.existsSync(path));

            browser = await puppeteer.launch({
                executablePath,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                ],
                headless: "new",
            });
            const page = await browser.newPage();

            const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap');
              body { font-family: 'Inter', sans-serif; color: #1e293b; margin: 0; padding: 0; background: #fff; }
              .invoice-container { max-width: 800px; margin: auto; padding: 40px; }
              .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 50px; border-bottom: 2px solid #f1f5f9; padding-bottom: 30px; }
              .brand { display: flex; align-items: center; gap: 15px; }
              .logo { width: 140px; height: auto; object-fit: contain; }
              .invoice-meta { text-align: right; }
              .invoice-meta h1 { margin: 0; font-size: 32px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
              .meta-item { display: flex; justify-content: flex-end; gap: 10px; margin-top: 5px; font-size: 13px; color: #64748b; }
              .meta-item b { color: #1e293b; }
              
              .billing-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
              .billing-box h3 { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px; letter-spacing: 1px; }
              .billing-box p { font-size: 14px; line-height: 1.5; margin: 0; color: #1e293b; }
              .billing-box b { color: #0f172a; }

              table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
              th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 15px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; }
              td { padding: 15px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155; }
              .item-desc { font-weight: 700; color: #0f172a; }
              .item-sub { font-size: 12px; color: #64748b; display: block; margin-top: 4px; }
              
              .totals { display: flex; justify-content: flex-end; }
              .totals-box { width: 250px; background: #f8fafc; padding: 20px; border-radius: 16px; }
              .total-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
              .total-row.grand { margin-top: 10px; padding-top: 10px; border-top: 2px solid #e2e8f0; font-weight: 800; font-size: 18px; color: #10b981; }
              
              .footer { margin-top: 60px; text-align: center; border-top: 2px solid #f1f5f9; padding-top: 30px; }
              .footer p { font-size: 12px; color: #94a3b8; margin: 5px 0; }
              .stamp { margin: 20px auto; width: 120px; height: 120px; border: 4px double #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; transform: rotate(-15deg); color: #10b981; font-weight: 800; font-size: 14px; text-transform: uppercase; opacity: 0.6; }
          </style>
      </head>
      <body>
          <div class="invoice-container">
              <div class="header">
                  <div class="brand">
                      <img src="https://new.studieslearning.com/Studies-learning/Back-Office-Formateurs/admin/assets/images/logosl.png" class="logo" alt="Logo">
                  </div>
                  <div class="invoice-meta">
                      <h1>FACTURE</h1>
                      <div class="meta-item">N° <b>${order.reference}</b></div>
                      <div class="meta-item">Date <b>${new Date().toLocaleDateString("fr-FR")}</b></div>
                  </div>
              </div>

              <div class="billing-section">
                  <div class="billing-box">
                      <h3>Émetteur</h3>
                      <p><b>Studies Holding Sarl</b></p>
                      <p>Douala, Cameroun</p>
                      <p>contact@studieslearning.com</p>
                      <p>RCCM: RC/DLA/2021/B/1234</p>
                  </div>
                  <div class="billing-box">
                      <h3>Client</h3>
                      <p><b>${order.customerName}</b></p>
                      <p>${order.customerEmail}</p>
                      <p>${order.customerPhone || ''}</p>
                      <p>${order.customerCity || ''}</p>
                  </div>
              </div>

              <table>
                  <thead>
                      <tr>
                          <th>Description</th>
                          <th style="text-align: right;">Prix Unitaire</th>
                          <th style="text-align: right;">Total</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr>
                          <td>
                              <span class="item-desc">Inscription Formation LMS</span>
                              <span class="item-sub">${order.formationName} (${order.lmsItemId})</span>
                          </td>
                          <td style="text-align: right;">${order.formationPrice} ${order.currency}</td>
                          <td style="text-align: right;">${order.formationPrice} ${order.currency}</td>
                      </tr>
                  </tbody>
              </table>

              <div class="totals">
                  <div class="totals-box">
                      <div class="total-row">
                          <span>Sous-total</span>
                          <b>${order.formationPrice} ${order.currency}</b>
                      </div>
                      <div class="total-row">
                          <span>Taxe (0%)</span>
                          <b>0 ${order.currency}</b>
                      </div>
                      <div class="total-row grand">
                          <span>Total Payé</span>
                          <span>${order.formationPrice} ${order.currency}</span>
                      </div>
                  </div>
              </div>

              <div class="stamp">
                  VALIDÉ <br> DIGITALEMENT
              </div>

              <div class="footer">
                  <p>Études. Inscriptions. Réussite.</p>
                  <p><b>Studies Learning</b> - Plateforme d'apprentissage professionnelle</p>
                  <p>Document généré automatiquement le ${new Date().toLocaleString("fr-FR")}</p>
              </div>
          </div>
      </body>
      </html>
      `;

            await page.setContent(htmlContent);
            const pdfBuffer = await page.pdf({ format: "A4" });

            await browser.close();
            return pdfBuffer;
        } catch (error) {
            console.warn("[InvoiceService] PDF generation failed:", error.message);
            if (browser) {
                try {
                    await browser.close();
                } catch (e) { }
            }
            return null;
        }
    }
}
