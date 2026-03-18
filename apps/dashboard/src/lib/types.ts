// =============================================================================
// Shared TypeScript Types — Studies PSP Dashboard
// Mirrors the backend data models (aggp_* tables)
// =============================================================================

// ── Provider ─────────────────────────────────────────────────────────────────

export type ProviderHealthStatus =
  | "operational"
  | "degraded"
  | "critical"
  | "idle"
  | "inactive";

export interface Provider {
  providerId: number;
  name: string;
  code: string;
  isActive: boolean;
  supportCard: boolean;
  supportMobileMoney: boolean;
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  healthStatus: ProviderHealthStatus;
}

export interface ProviderError {
  errorCode: string;
  errorMessage: string;
  occurrences: number;
}

export interface SparklinePoint {
  hour: string;
  total: number;
  successes: number;
  successRate: number;
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

export interface OverviewKpis {
  revenue24h: number;
  transactionCount24h: number;
  successRate: number;
  failoverRate: number;
  failoverCount: number;
  trends: {
    revenue: number;
    transactions: number;
  };
}

export interface TimeSeriesPoint {
  period: string;
  totalCount: number;
  successCount: number;
  revenue: number;
  successRate: number | string;
}

// ── LMS Analytics ─────────────────────────────────────────────────────────────

export interface TopFormation {
  courseId: string;
  courseName: string;
  packageType: string | null;
  salesCount: number;
  totalRevenue: number;
  avgAmount: number;
  currency: string;
}

export interface WalletSummary {
  activeWallets: number;
  totalBalance: number;
  totalEarned: number;
  monthlyCredit: number;
  topFormateurs: {
    name: string;
    email: string;
    balance: number;
    totalEarned: number;
    formationCount: number;
  }[];
}

export interface FormationsStats {
  totalPublished: number;
  newThisMonth: number;
}

export interface LmsAnalytics {
  topFormations: TopFormation[];
  walletSummary: WalletSummary | null;
  formationsStats: FormationsStats | null;
}

// ── Routing ──────────────────────────────────────────────────────────────────

export interface ProviderRoute {
  id: number;
  provider: { id: number; name: string; code: string };
  countryCode: string;
  currency: string;
  minAmount: number;
  maxAmount: number | null;
  priority: number;
  isActive: boolean;
}

export interface RouteMatrix {
  matrix: Record<
    string,
    Record<
      string,
      {
        routeId: number;
        priority: number;
        isActive: boolean;
        currency: string;
      }
    >
  >;
  countries: string[];
  providers: { id: number; name: string; code: string }[];
}

export interface RouteSimulationResult {
  input: {
    countryCode: string;
    currency: string;
    amount: number;
    paymentMethod: string;
  };
  selectedProvider: SimulatedProvider | null;
  fallbackChain: SimulatedProvider[];
  totalCandidates: number;
}

export interface SimulatedProvider {
  position: number;
  providerId: number;
  providerName: string;
  providerCode: string;
  priority: number;
  isActive: boolean;
}

// ── Transactions ──────────────────────────────────────────────────────────────

export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "refunded";

export interface Transaction {
  id: number;
  status: PaymentStatus;
  amount: number;
  currency: string;
  provider: string | null;
  orderReference: string;
  orderId: number | null;
  customerEmail: string;
  createdAt: string;
}

// ── Orders (LMS Workflow) ──────────────────────────────────────────────────

export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAYMENT_FAILED"
  | "PAYMENT_CONFIRMED"
  | "VALIDATED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED"
  // Legacy lowercase statuses
  | "pending"
  | "processing"
  | "payment_failed"
  | "payment_confirmed"
  | "validated"
  | "completed"
  | "rejected"
  | "cancelled"
  | "expired"
  | "refunded";

export type PurchaseType = "self" | "gift" | "b2b";

export interface Order {
  id: number;
  reference: string;
  customerEmail: string;
  customerName: string | null;
  customerSurname: string | null;
  customerPhone: string | null;
  customerCity: string | null;
  customerCountry: string | null;
  currency: string;
  totalAmount: number;
  status: OrderStatus;
  purchaseType: PurchaseType;
  // Formation/LMS info
  formationId: number | null;
  formationName: string | null;
  formationPrice: number | null;
  lmsItemId: string | null;
  lmsItemType: "course" | "package" | "subscription" | null;
  // Beneficiary info (if gift)
  beneficiaryFirstName: string | null;
  beneficiaryLastName: string | null;
  beneficiaryEmail: string | null;
  beneficiaryPhone: string | null;
  beneficiaryCountry: string | null;
  beneficiaryRelationship: string | null;
  // Validation
  validatedAt: Date | string | null;
  validatedBy: number | null;
  adminNotes: string | null;
  rejectionReason: string | null;
  // Completion
  completedAt: Date | string | null;
  completedBy: number | null;
  campusUsername: string | null;
  // Credentials (sent to customer)
  credentialsSentAt: Date | string | null;
  credentialsSentTo: string | null;
  // Payment info
  paidAt: Date | string | null;
  paymentIntentId: string | null;
  paymentProvider: string | null;
  transactionReference: string | null;
  // Metadata
  metadata: Record<string, unknown> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface OrderAuditLog {
  id: number;
  orderId: number;
  orderReference: string;
  action: string;
  actionLabel: string;
  actorType: "system" | "admin" | "webhook" | "api";
  actorId: number | null;
  actorEmail: string | null;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  emailSentTo: string | null;
  emailSentAt: Date | null;
  createdAt: Date;
}

export interface OrdersResponse {
  success: boolean;
  data: Order[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

export interface OrderDetailResponse {
  success: boolean;
  data: Order;
}

export interface OrderAuditResponse {
  success: boolean;
  data: OrderAuditLog[];
}

// ── Formations (WordPress/LearnPress) ─────────────────────────────────────────

export interface Formation {
  id: string;
  title: string;
  price: number;
  thumbnail: string | null;
  description?: string;
  instructor?: string;
  duration?: string;
  createdAt: string;
}

export interface FormationsResponse {
  success: boolean;
  data: Formation[];
}

export interface TransactionAttempt {
  id: number;
  transactionNumber: string;
  provider: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface TransactionDetail {
  intent: {
    id: number;
    status: PaymentStatus;
    amount: number;
    currency: string;
    selectedProvider: string;
    idempotencyKey: string;
    createdAt: string;
  };
  order: {
    id: number;
    reference: string;
    status: PaymentStatus;
    customerEmail: string;
    totalAmount: number;
    metadata?: Record<string, string>;
  };
  attempts: TransactionAttempt[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export interface WebhookEvent {
  id: number;
  provider: string;
  eventType: string;
  signatureValid: boolean;
  processed: boolean;
  processedAt: string | null;
  retryCount: number;
  createdAt: string;
}

export interface WebhookStats {
  total24h: number;
  processedCount: number;
  processingRate: number | string;
  invalidSignatureCount: number;
  pendingCount: number;
  avgProcessingSeconds: number | string;
}

// ── Geo ───────────────────────────────────────────────────────────────────────

export interface GeoBreakdown {
  countryCode: string;
  totalAttempts: number;
  successCount: number;
  volume: number;
  successRate: number | string;
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: number;
  adminIdentifier: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payload: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface NotificationSetting {
  id: number;
  adminEmail: string;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  notifyOnSuspicious: boolean;
  notifyOnNewOrder: boolean;
  notifyWithSound: boolean;
  isActive: boolean;
  createdAt?: string;
}

// ── API Response Wrapper ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  status: "success" | "fail" | "error";
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

// ── Order Helper Functions ───────────────────────────────────────────────────────

/**
 * Check if order is a B2B purchase
 */
export function isB2BOrder(order: Order): boolean {
  if (order.metadata) {
    return order.metadata.is_b2b === true || order.metadata.b2b_purchase === true;
  }
  return order.lmsItemType === 'package' || order.purchaseType === 'b2b';
}

/**
 * Get display label for purchase type
 */
export function getPurchaseTypeLabel(type: PurchaseType): string {
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
export function getLmsItemTypeLabel(type: string): string {
  switch (type) {
    case 'course':
      return 'Formation';
    case 'package':
      return 'Package';
    case 'subscription':
      return 'Abonnement';
    default:
      return 'Formation';
  }
}

/**
 * Check if order can be validated
 */
export function canValidateOrder(order: Order): boolean {
  return order.status === 'payment_confirmed';
}

/**
 * Check if order can be completed (manual completion only for formations, not B2B)
 */
export function canCompleteOrder(order: Order): boolean {
  // B2B orders are automatically provisioned, no manual completion needed
  if (order.lmsItemType === 'package' || order.purchaseType === 'b2b') {
    return false;
  }
  return order.status === 'validated';
}

/**
 * Get license count from order
 */
export function getLicenseCount(order: Order): number {
  if (order.metadata) {
    const meta = order.metadata as Record<string, any>;
    return meta.total_licenses || meta.licence_count || meta.backendLicenceCount || 1;
  }
  return 1;
}

/**
 * Get company info from order
 */
export function getCompanyInfo(order: Order): { name: string; industry: string; adminEmail: string } | null {
  if (!order.metadata) {
    return null;
  }
  const meta = order.metadata as Record<string, any>;
  const isB2B = meta.is_b2b === true || meta.b2b_purchase === true;

  if (!isB2B && order.lmsItemType !== 'package' && order.purchaseType !== 'b2b') {
    return null;
  }

  return {
    name: String(meta.company_name || order.customerName || 'Entreprise'),
    industry: String(meta.company_industry || 'N/A'),
    adminEmail: String(meta.company_admin_email || order.customerEmail || ''),
  };
}
