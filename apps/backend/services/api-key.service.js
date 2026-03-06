import { ApiKey } from "../models/index.js";
import crypto from 'node:crypto';

export class ApiKeyService {
    /**
     * Generate a new API key
     * @param {string} owner 
     * @param {string} [email]
     * @returns {Promise<ApiKey>}
     */
    static async generate(owner, email = null) {
        // If an email is provided (Admin key), deactivate all previous keys for this email
        if (email) {
            await ApiKey.update(
                { isActive: false },
                { where: { email: email.toLowerCase(), isActive: true } }
            );
        }

        const key = `sk_${crypto.randomBytes(24).toString('hex')}`;

        return await ApiKey.create({
            key,
            owner,
            email: email ? email.toLowerCase() : null,
            isActive: true
        });
    }

    /**
     * Validate an API key
     * @param {string} key 
     * @returns {Promise<boolean>}
     */
    static async validate(key) {
        if (!key) return false;

        const apiKey = await ApiKey.findOne({
            where: { key, isActive: true }
        });

        if (apiKey) {
            apiKey.lastUsedAt = new Date();
            await apiKey.save();
            return true;
        }

        return false;
    }

    /**
     * Find a full ApiKey record by key string
     * Used by admin middleware for RBAC owner check
     * @param {string} key 
     * @returns {Promise<ApiKey|null>}
     */
    static async findByKey(key) {
        if (!key) return null;

        const apiKey = await ApiKey.findOne({
            where: { key, isActive: true }
        });

        if (apiKey) {
            apiKey.lastUsedAt = new Date();
            await apiKey.save();
        }

        return apiKey || null;
    }
}
