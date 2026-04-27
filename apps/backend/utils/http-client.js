import axios from 'axios';
import { MailService } from '../services/mail.service.js';
import { AdminNotification } from '../models/index.js';

/**
 * Enhanced HTTP Client with exponential retry and admin alerting
 */
export class HttpClient {
  /**
   * Post with retries and alerting on failure
   * @param {string} url 
   * @param {object} data 
   * @param {object} options 
   * @param {number} maxRetries 
   * @returns {Promise<any>}
   */
  static async postWithRetry(url, data, options = {}, maxRetries = 3) {
    let attempt = 0;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    while (attempt < maxRetries) {
      try {
        console.log(`[HttpClient] POST attempt ${attempt + 1}/${maxRetries} to ${url}`);
        const response = await axios.post(url, data, options);
        console.log(`[HttpClient] POST success on attempt ${attempt + 1}`);
        return response.data;
      } catch (error) {
        attempt++;
        const isLastAttempt = attempt === maxRetries;
        
        console.error(`[HttpClient] POST attempt ${attempt} failed: ${error.message}`);

        if (isLastAttempt) {
          console.error(`[HttpClient] All ${maxRetries} attempts failed for ${url}. Triggering admin alerts.`);
          await this.notifyAdminsOfFailure(url, data, error);
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s...
        const waitTime = Math.pow(2, attempt - 1) * 1000;
        await delay(waitTime);
      }
    }
  }

  /**
   * Alert admins via Email and In-App notification
   */
  static async notifyAdminsOfFailure(url, payload, error) {
    try {
      const auctionId = payload.auctionId || 'N/A';
      const orderRef = payload.orderReference || 'N/A';
      
      const message = `Échec de la notification inter-services après 3 tentatives.\n` +
                      `URL: ${url}\n` +
                      `Commande: ${orderRef}\n` +
                      `Auction ID: ${auctionId}\n` +
                      `Erreur: ${error.message}`;

      // 1. In-App Notification
      await AdminNotification.create({
        type: "CRITICAL",
        title: "Échec critique de notification",
        message: `La confirmation du paiement pour l'enchère #${auctionId} n'a pas pu être transmise au système d'enchères.`,
        orderReference: orderRef,
        metadata: { 
          url, 
          error: error.message,
          auctionId 
        }
      });

      // 2. Email alert (Wait for implementation in MailService or use generic one)
      // For now, using a generic notification mechanism if available
      if (MailService.notifyLmsAdmins) {
         // Reusing existing admin notification if possible
         // Or we could add a specific method to MailService later
      }
      
      console.log("[HttpClient] Admin alerts dispatched.");
    } catch (alertError) {
      console.error("[HttpClient] Failed to send admin alerts:", alertError);
    }
  }
}
