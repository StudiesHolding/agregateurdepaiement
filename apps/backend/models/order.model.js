import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";
import { OrderStatus } from "../enums/index.js";

export class Order extends Model { }

Order.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        reference: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
        },
        customerEmail: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'customer_email',
        },
        customerName: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'customer_name',
        },
        customerSurname: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'customer_surname',
        },
        customerPhone: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'customer_phone',
        },
        customerCity: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'customer_city',
        },
        customerCountry: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'customer_country',
        },
        currency: {
            type: DataTypes.STRING(10),
            allowNull: false,
        },
        totalAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            field: 'total_amount',
        },
        status: {
            type: DataTypes.ENUM(...Object.values(OrderStatus)),
            defaultValue: OrderStatus.PENDING,
        },

        // === LMS Fields ===
        lmsItemId: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'lms_item_id',
        },
        lmsItemType: {
            type: DataTypes.ENUM("course", "package", "subscription"),
            allowNull: true,
            field: 'lms_item_type',
        },
        formationId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true,
            field: 'formation_id',
        },
        formationName: {
            type: DataTypes.STRING(500),
            allowNull: true,
            field: 'formation_name',
        },
        formationPrice: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true,
            field: 'formation_price',
        },

        // === Purchase Type ===
        purchaseType: {
            type: DataTypes.ENUM("self", "gift"),
            defaultValue: "self",
            field: 'purchase_type',
        },

        // === Beneficiary (for gifts) ===
        beneficiaryEmail: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'beneficiary_email',
        },
        beneficiaryFirstName: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'beneficiary_first_name',
        },
        beneficiaryLastName: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'beneficiary_last_name',
        },
        beneficiaryPhone: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'beneficiary_phone',
        },
        beneficiaryRelationship: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'beneficiary_relationship',
        },
        beneficiaryCountry: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'beneficiary_country',
        },

        // === Payment Info ===
        paidAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'paid_at',
        },
        paymentIntentId: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'payment_intent_id',
        },
        paymentProvider: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'payment_provider',
        },
        transactionReference: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'transaction_reference',
        },

        // === Validation ===
        validatedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'validated_at',
        },
        validatedBy: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true,
            field: 'validated_by',
        },
        adminNotes: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'admin_notes',
        },
        rejectionReason: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'rejection_reason',
        },

        // === Completion ===
        completedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'completed_at',
        },
        completedBy: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true,
            field: 'completed_by',
        },
        campusUsername: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'campus_username',
        },
        credentialsSentAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'credentials_sent_at',
        },
        credentialsSentTo: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'credentials_sent_to',
        },

        // === Legacy / Extra ===
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "Order",
        tableName: "aggp_orders",
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    }
);

export default Order;
