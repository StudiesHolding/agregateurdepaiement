/**
 * Payment Aggregator Enums
 */

export const PaymentStatus = {
  CREATED: "created",
  PROCESSING: "processing",
  REQUIRES_ACTION: "requires_action",
  SUCCEEDED: "succeeded",
  CANCELED: "canceled",
  FAILED: "failed",
  REFUNDED: "refunded",
};

export const OrderStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  PAYMENT_FAILED: "payment_failed",
  PAYMENT_CONFIRMED: "payment_confirmed",
  VALIDATED: "validated",
  COMPLETED: "completed",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  REFUNDED: "refunded",
};

export const AttemptStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "canceled",
};

export const ProviderCode = {
  STRIPE: "stripe",
  CINETPAY: "cinetpay",
  MAVIANCE: "maviance",
  KKIAPAY: "kkiapay",
};

export const PaymentMethodType = {
  CARD: "card",
  MOBILE_MONEY: "mobile_money",
};

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};
