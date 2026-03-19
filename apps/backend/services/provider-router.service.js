import { ProviderRoute } from "../models/provider-route.model.js";
import { PaymentProvider } from "../models/payment-provider.model.js";
import { Op } from "sequelize";

/**
 * Payment routing configuration
 * Card payments → Stripe (always)
 * Mobile Money → Local aggregators based on country
 * Unknown country → Stripe as default
 * 
 * Note: Provider codes in DB are lowercase (stripe, cinetpay, etc.)
 */
const PAYMENT_ROUTING = {
    // Card payments always go to Stripe
    card: {
        defaultProvider: 'stripe',
        supportedCurrencies: ['EUR', 'USD', 'XAF', 'XOF']
    },
    // Mobile money goes to local aggregators
    mobile_money: {
        countryProviders: {
            'CM': ['cinetpay', 'kkiapay'],  // Cameroon
            'CI': ['cinetpay'],              // Ivory Coast
            'SN': ['cinetpay'],              // Senegal
            'BJ': ['kkiapay', 'cinetpay'],   // Benin
            'TG': ['cinetpay'],              // Togo
            'BF': ['cinetpay'],              // Burkina Faso
            'ML': ['cinetpay'],              // Mali
            'NE': ['cinetpay'],              // Niger
            'GH': [],                        // Ghana - no local provider yet
            'NG': [],                        // Nigeria - no local provider yet
        },
        defaultProvider: 'cinetpay', // Fallback to CinetPay for mobile money
        supportedCurrencies: ['XAF', 'XOF']
    }
};

export class ProviderRouterService {
    /**
     * Find all available routes for a country/currency/amount
     * @param {string} countryCode 
     * @param {string} currency 
     * @param {number} amount 
     * @returns {Promise<ProviderRoute[]>}
     */
    static async findAvailableRoutes(countryCode, currency, amount, paymentMethod = 'card') {
        // Smart routing based on payment method
        if (paymentMethod === 'card') {
            // Card payments: Always use Stripe
            return await this.findStripeRoutes(currency, amount);
        } else {
            // Mobile Money: Use local aggregators based on country
            return await this.findMobileMoneyRoutes(countryCode, currency, amount);
        }
    }

    /**
     * Find Stripe routes for card payments
     */
    static async findStripeRoutes(currency, amount) {
        // First try to find currency-specific Stripe route
        const stripeRoutes = await ProviderRoute.findAll({
            where: {
                [Op.or]: [
                    { countryCode: '*' },
                    { countryCode: { [Op.like]: '%' } } // Match any country for global providers
                ],
                currency: currency,
                isActive: true,
                [Op.and]: [
                    { minAmount: { [Op.lte]: amount } },
                    {
                        [Op.or]: [{ maxAmount: { [Op.gte]: amount } }, { maxAmount: null }],
                    },
                ],
            },
            include: [
                {
                    model: PaymentProvider,
                    as: "provider",
                    where: {
                        isActive: true,
                        [Op.or]: [
                            { code: 'stripe' },  // lowercase
                            { code: 'STRIPE' }   // uppercase fallback
                        ]
                    },
                },
            ],
            order: [["priority", "ASC"]],
        });

        if (stripeRoutes.length > 0) {
            return stripeRoutes;
        }

        // Fallback: Try to find any active Stripe route for any currency
        return await ProviderRoute.findAll({
            where: {
                [Op.or]: [
                    { countryCode: '*' },
                    { countryCode: { [Op.like]: '%' } }
                ],
                isActive: true,
                [Op.and]: [
                    { minAmount: { [Op.lte]: amount } },
                    {
                        [Op.or]: [{ maxAmount: { [Op.gte]: amount } }, { maxAmount: null }],
                    },
                ],
            },
            include: [
                {
                    model: PaymentProvider,
                    as: "provider",
                    where: {
                        isActive: true,
                        [Op.or]: [
                            { code: 'stripe' },
                            { code: 'STRIPE' }
                        ]
                    },
                },
            ],
            order: [["priority", "ASC"]],
        });
    }

    /**
     * Find mobile money routes based on country
     * Uses DB routes as primary source, with fallback to hardcoded config
     */
    static async findMobileMoneyRoutes(countryCode, currency, amount) {
        // First try: Get routes from DB for this country and currency
        let routes = await ProviderRoute.findAll({
            where: {
                [Op.or]: [
                    { countryCode: countryCode },
                    { countryCode: '*' }
                ],
                currency: currency,
                isActive: true,
                [Op.and]: [
                    { minAmount: { [Op.lte]: amount } },
                    {
                        [Op.or]: [{ maxAmount: { [Op.gte]: amount } }, { maxAmount: null }],
                    },
                ],
            },
            include: [
                {
                    model: PaymentProvider,
                    as: "provider",
                    where: {
                        isActive: true,
                        supportMobileMoney: true
                    },
                },
            ],
            order: [["priority", "ASC"]],
        });

        if (routes.length > 0) {
            return routes;
        }

        // Second try: Get any mobile money route for this country (any currency)
        routes = await ProviderRoute.findAll({
            where: {
                [Op.or]: [
                    { countryCode: countryCode },
                    { countryCode: '*' }
                ],
                isActive: true,
                [Op.and]: [
                    { minAmount: { [Op.lte]: amount } },
                    {
                        [Op.or]: [{ maxAmount: { [Op.gte]: amount } }, { maxAmount: null }],
                    },
                ],
            },
            include: [
                {
                    model: PaymentProvider,
                    as: "provider",
                    where: {
                        isActive: true,
                        supportMobileMoney: true
                    },
                },
            ],
            order: [["priority", "ASC"]],
        });

        if (routes.length > 0) {
            return routes;
        }

        // Third try: Fallback to hardcoded config providers
        const countryProviders = PAYMENT_ROUTING.mobile_money.countryProviders[countryCode] || [];
        const defaultProvider = PAYMENT_ROUTING.mobile_money.defaultProvider;
        const providersToUse = countryProviders.length > 0 ? countryProviders : [defaultProvider];

        return await ProviderRoute.findAll({
            where: {
                [Op.or]: [
                    { countryCode: countryCode },
                    { countryCode: '*' }
                ],
                isActive: true,
                [Op.and]: [
                    { minAmount: { [Op.lte]: amount } },
                    {
                        [Op.or]: [{ maxAmount: { [Op.gte]: amount } }, { maxAmount: null }],
                    },
                ],
            },
            include: [
                {
                    model: PaymentProvider,
                    as: "provider",
                    where: {
                        isActive: true,
                        [Op.or]: [
                            { code: { [Op.in]: providersToUse } },
                            { code: 'cinetpay' }
                        ]
                    },
                },
            ],
            order: [["priority", "ASC"]],
        });
    }

    /**
     * Filter routes by payment method type
     * @param {ProviderRoute[]} routes 
     * @param {string} paymentMethod (card or mobile_money)
     * @returns {ProviderRoute[]}
     */
    static filterByPaymentMethod(routes, paymentMethod) {
        const methodField =
            paymentMethod === "card" ? "supportCard" : "supportMobileMoney";

        return routes.filter((route) => {
            const provider = route.provider;
            return provider[methodField] === true;
        });
    }

    /**
     * Create a new route
     * @param {Object} data 
     * @returns {Promise<ProviderRoute>}
     */
    static async createRoute(data) {
        return await ProviderRoute.create(data);
    }
}
