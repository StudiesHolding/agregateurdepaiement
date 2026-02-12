import puppeteer from "puppeteer";

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
      browser = await puppeteer.launch({
        executablePath:
          process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
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
              body { font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; color: #555; max-width: 800px; margin: auto; padding: 30px; }
              .invoice-box { border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, .15); padding: 30px; font-size: 16px; line-height: 24px; color: #555; }
              .invoice-box table { width: 100%; line-height: inherit; text-align: left; }
              .invoice-box table td { padding: 5px; vertical-align: top; }
              .invoice-box table tr td:nth-child(2) { text-align: right; }
              .invoice-box table tr.top table td { padding-bottom: 20px; }
              .invoice-box table tr.top table td.title { font-size: 45px; line-height: 45px; color: #333; }
              .invoice-box table tr.information table td { padding-bottom: 40px; }
              .invoice-box table tr.heading td { background: #eee; border-bottom: 1px solid #ddd; font-weight: bold; }
              .invoice-box table tr.details td { padding-bottom: 20px; }
              .invoice-box table tr.item td { border-bottom: 1px solid #eee; }
              .invoice-box table tr.item.last td { border-bottom: none; }
              .invoice-box table tr.total td:nth-child(2) { border-top: 2px solid #eee; font-weight: bold; }
              .brand { color: #2c3e50; font-weight: bold; font-size: 24px; }
          </style>
      </head>
      <body>
          <div class="invoice-box">
              <table cellpadding="0" cellspacing="0">
                  <tr class="top">
                      <td colspan="2">
                          <table>
                              <tr>
                                  <td class="title">
                                      <span class="brand">STUDIES LEARNING</span>
                                  </td>
                                  <td>
                                      Facture #: ${intent.id}<br>
                                      Date: ${new Date().toLocaleDateString("fr-FR")}<br>
                                      Référence: ${order.reference}
                                  </td>
                              </tr>
                          </table>
                      </td>
                  </tr>
                  <tr class="information">
                      <td colspan="2">
                          <table>
                              <tr>
                                  <td>
                                      Studies Holding SAS<br>
                                      75000 Paris, France<br>
                                      contact@studieslearning.com
                                  </td>
                                  <td>
                                      ${order.customerName}<br>
                                      ${order.customerEmail}
                                  </td>
                              </tr>
                          </table>
                      </td>
                  </tr>
                  <tr class="heading">
                      <td>Désignation</td>
                      <td>Prix</td>
                  </tr>
                  <tr class="item">
                      <td>Paiement formation / Services (Commande ${order.reference})</td>
                      <td>${intent.amount} ${intent.currency}</td>
                  </tr>
                  <tr class="total">
                      <td></td>
                      <td>Total: ${intent.amount} ${intent.currency}</td>
                  </tr>
              </table>
              <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #999;">
                  Merci pour votre achat !
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
        } catch (e) {}
      }
      return null;
    }
  }
}
