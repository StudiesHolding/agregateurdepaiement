import { Order } from "../models/order.model.js";
import { v4 as uuidv4 } from "../utils/uuid.js";
import { OrderStatus } from "../enums/index.js";

export class OrderService {
    /**
     * Create a new order
     * @param {Object} data 
     * @returns {Promise<Order>}
     */
    static async create(data) {
        const reference = this.generateReference();

        const order = await Order.create({
            reference,
            customerEmail: data.customerEmail,
            customerName: data.customerName,
            currency: data.currency,
            totalAmount: data.totalAmount,
            metadata: data.metadata || {},
            lmsItemId: data.lmsItemId,
            lmsItemType: data.lmsItemType,
            status: OrderStatus.PENDING,
        });

        return order;
    }

    /**
     * Find order by ID
     * @param {number|string} id 
     * @returns {Promise<Order>}
     */
    static async findById(id) {
        return await Order.findByPk(id);
    }

    /**
     * Find order by reference
     * @param {string} reference 
     * @returns {Promise<Order>}
     */
    static async findByReference(reference) {
        return await Order.findOne({ where: { reference } });
    }

    /**
     * Update order status
     * @param {number|string} id 
     * @param {string} status 
     * @returns {Promise<[number]>}
     */
    static async updateStatus(id, status) {
        return await Order.update({ status }, { where: { id } });
    }

    /**
     * Generate a unique order reference
     * @returns {string}
     */
    static generateReference() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = uuidv4().substring(0, 8).toUpperCase();
        return `ORD-${timestamp}-${random}`;
    }
}
