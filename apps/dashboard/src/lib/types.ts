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

export type PurchaseType = "self" | "gift";

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
