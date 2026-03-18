/**
 * Order Types - Normalized Types for Dashboard
 * 
 * This file provides consistent type definitions for Order data
 * across the dashboard application.
 * 
 * The backend uses snake_case, but we normalize to camelCase
 * for consistent usage throughout the frontend.
 */

// ============================================================================
// Order Status Types
// ============================================================================

export type OrderStatus =
    | 'pending'
    | 'processing'
    | 'payment_failed'
    | 'payment_confirmed'
    | 'validated'
    | 'completed'
    | 'rejected'
    | 'cancelled'
    | 'expired'
    | 'refunded';

export type PurchaseType = 'self' | 'gift' | 'b2b';

export type LmsItemType = 'course' | 'package';

// ============================================================================
// Order Metadata Types
// ============================================================================

export interface OrderMetadata {
    // B2B fields
    is_b2b?: boolean;
    b2b_purchase?: boolean;
    company_name?: string;
    company_industry?: string;
    company_admin_email?: string;
    total_licenses?: number;
    licence_count?: number;
    backendLicenceCount?: number;
    backendUnitPrice?: number;

    // Provisioning status
    provisioning_status?: 'pending' | 'completed' | 'failed';
    company_id?: number;

    // Source tracking
    source?: string;
    validatedByBackend?: boolean;

    // Legacy/Extra
    [key: string]: any;
}

// ============================================================================
// Order Interface (Normalized)
// ============================================================================

export interface Order {
    // Identifiers
    id: number;
    reference: string;

    // Customer Info (normalized camelCase with snake_case fallback)
    customerEmail: string;
    customerName: string;
    customerSurname: string;
    customerPhone: string;
    customerCity: string;
    customerCountry: string;

    // Purchase Details
    currency: string;
    totalAmount: number;

    // Status & Type
    status: OrderStatus;
    purchaseType: PurchaseType;
    lmsItemType: LmsItemType;

    // LMS/Formation Details
    lmsItemId: string;
    formationId: number;
    formationName: string;
    formationPrice: number;

    // Beneficiary (for gift purchases)
    beneficiaryEmail?: string;
    beneficiaryFirstName?: string;
    beneficiaryLastName?: string;
    beneficiaryPhone?: string;
    beneficiaryRelationship?: string;
    beneficiaryCountry?: string;

    // Payment Info
    paidAt?: string;
    paymentIntentId?: string;
    paymentProvider?: string;
    transactionReference?: string;

    // Validation
    validatedAt?: string;
    validatedBy?: number;
    adminNotes?: string;
    rejectionReason?: string;

    // Completion
    completedAt?: string;
    completedBy?: number;
    campusUsername?: string;
    credentialsSentAt?: string;
    credentialsSentTo?: string;

    // Metadata
    metadata?: OrderMetadata;

    // Timestamps
    createdAt?: string;
    updatedAt?: string;
}

// ============================================================================
// Raw Order from API (snake_case)
// ============================================================================

export interface RawOrder {
    // Identifiers
    id: number;
    reference: string;

    // Customer Info (snake_case from backend)
    customer_email: string;
    customer_name: string;
    customer_surname: string;
    customer_phone: string;
    customer_city: string;
    customer_country: string;

    // Purchase Details
    currency: string;
    total_amount: number;

    // Status & Type
    status: OrderStatus;
    purchase_type: PurchaseType;
    lms_item_type: LmsItemType;

    // LMS/Formation Details
    lms_item_id: string;
    formation_id: number;
    formation_name: string;
    formation_price: number;

    // Beneficiary
    beneficiary_email?: string;
    beneficiary_first_name?: string;
    beneficiary_last_name?: string;
    beneficiary_phone?: string;
    beneficiary_relationship?: string;
    beneficiary_country?: string;

    // Payment Info
    paid_at?: string;
    payment_intent_id?: string;
    payment_provider?: string;
    transaction_reference?: string;

    // Validation
    validated_at?: string;
    validated_by?: number;
    admin_notes?: string;
    rejection_reason?: string;

    // Completion
    completed_at?: string;
    completed_by?: number;
    campus_username?: string;
    credentials_sent_at?: string;
    credentials_sent_to?: string;

    // Metadata
    metadata?: OrderMetadata;

    // Timestamps
    created_at: string;
    updated_at: string;
}

// ============================================================================
// Transformer Functions
// ============================================================================

/**
 * Transform raw API order (snake_case) to normalized order (camelCase)
 */
export function transformOrder(raw: RawOrder): Order {
    return {
        // Identifiers
        id: raw.id,
        reference: raw.reference,

        // Customer Info
        customerEmail: raw.customer_email,
        customerName: raw.customer_name,
        customerSurname: raw.customer_surname,
        customerPhone: raw.customer_phone,
        customerCity: raw.customer_city,
        customerCountry: raw.customer_country,

        // Purchase Details
        currency: raw.currency,
        totalAmount: Number(raw.total_amount),

        // Status & Type
        status: raw.status,
        purchaseType: raw.purchase_type,
        lmsItemType: raw.lms_item_type,

        // LMS/Formation Details
        lmsItemId: raw.lms_item_id,
        formationId: raw.formation_id,
        formationName: raw.formation_name,
        formationPrice: Number(raw.formation_price),

        // Beneficiary
        beneficiaryEmail: raw.beneficiary_email,
        beneficiaryFirstName: raw.beneficiary_first_name,
        beneficiaryLastName: raw.beneficiary_last_name,
        beneficiaryPhone: raw.beneficiary_phone,
        beneficiaryRelationship: raw.beneficiary_relationship,
        beneficiaryCountry: raw.beneficiary_country,

        // Payment Info
        paidAt: raw.paid_at,
        paymentIntentId: raw.payment_intent_id,
        paymentProvider: raw.payment_provider,
        transactionReference: raw.transaction_reference,

        // Validation
        validatedAt: raw.validated_at,
        validatedBy: raw.validated_by,
        adminNotes: raw.admin_notes,
        rejectionReason: raw.rejection_reason,

        // Completion
        completedAt: raw.completed_at,
        completedBy: raw.completed_by,
        campusUsername: raw.campus_username,
        credentialsSentAt: raw.credentials_sent_at,
        credentialsSentTo: raw.credentials_sent_to,

        // Metadata
        metadata: raw.metadata,

        // Timestamps
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
    };
}

/**
 * Transform array of raw orders
 */
export function transformOrders(rawOrders: RawOrder[]): Order[] {
    return rawOrders.map(transformOrder);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if order is a B2B purchase
 */
export function isB2BOrder(order: Order | RawOrder): boolean {
    if ('metadata' in order && order.metadata) {
        return order.metadata.is_b2b === true || order.metadata.b2b_purchase === true;
    }
    if ('purchase_type' in order) {
        return order.purchase_type === 'b2b';
    }
    if ('lmsItemType' in order) {
        return order.lmsItemType === 'package';
    }
    return false;
}

/**
 * Get display label for purchase type
 */
export function getPurchaseTypeLabel(type: PurchaseType | string): string {
    switch (type) {
        case 'self':
            return '👤 Personnel';
        case 'gift':
            return '🎁 Cadeau';
        case 'b2b':
            return '🏢 Entreprise';
        default:
            return '👤 Personnel';
    }
}

/**
 * Get display label for LMS item type
 */
export function getLmsItemTypeLabel(type: LmsItemType | string): string {
    switch (type) {
        case 'course':
            return '🎓 Formation';
        case 'package':
            return '📦 Package';
        default:
            return '🎓 Formation';
    }
}

/**
 * Get status label in French
 */
export function getStatusLabel(status: OrderStatus | string): string {
    const labels: Record<string, string> = {
        pending: 'En attente',
        processing: 'Traitement',
        payment_failed: 'Échec',
        payment_confirmed: 'Confirmé',
        validated: 'Validée',
        completed: 'Terminée',
        rejected: 'Rejetée',
        cancelled: 'Annulée',
        expired: 'Expirée',
        refunded: 'Remboursée',
    };
    return labels[status] || status;
}

/**
 * Check if order can be validated
 */
export function canValidate(order: Order | RawOrder): boolean {
    const status = 'status' in order ? order.status : (order as any).status;
    return status === 'payment_confirmed';
}

/**
 * Check if order can be completed
 */
export function canComplete(order: Order | RawOrder): boolean {
    const status = 'status' in order ? order.status : (order as any).status;
    const lmsItemType = 'lmsItemType' in order
        ? order.lmsItemType
        : (order as any).lms_item_type;

    // B2B orders don't need manual completion (already provisioned)
    if (lmsItemType === 'package') {
        return false;
    }

    return status === 'validated';
}
