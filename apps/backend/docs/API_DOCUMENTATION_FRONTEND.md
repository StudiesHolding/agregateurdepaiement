# 📚 API Documentation - Studies Learning Payment Aggregator

> **Version:** 1.0.0  
> **Base URL:** `http://localhost:3000/api` (Production: your-domain.com/api)  
> **Authentication:** API Key via header `x-api-key`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Payment Flow](#payment-flow)
3. [Endpoints Overview](#endpoints-overview)
4. [Payment Endpoints](#payment-endpoints)
5. [Webhook Endpoints](#webhook-endpoints)
6. [Admin Endpoints](#admin-endpoints)
7. [Order Workflow](#order-workflow)
8. [Data Models](#data-models)
9. [Error Handling](#error-handling)
10. [Integration Examples](#integration-examples)

---

## 🔐 Authentication

### API Key Authentication

All API endpoints (except webhooks) require authentication using an API Key.

```http
GET /api/admin/orders
x-api-key: your_api_key_here
```

### Key Types

| Key Type  | Prefix    | Usage                                  |
| --------- | --------- | -------------------------------------- |
| Admin Key | `admin:*` | Full access to admin endpoints         |
| App Key   | `app:*`   | Limited access (payment creation only) |

### Getting an API Key

```bash
# Generate via dashboard or use the master key (development only)
ADMIN_MASTER_KEY=admin:studies:secret
```

---

## 💳 Payment Flow

### Complete Payment Lifecycle

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  Payment Init    │────▶│  Redirect to    │
│ Application │     │  POST /payments   │     │  Provider URL   │
└─────────────┘     └──────────────────┘     └─────────────────┘
                                                         │
                        ┌──────────────────┐              │
                        │   Webhook        │◀─────────────┘
                        │   Notification   │
                        └──────────────────┘
                                │
                        ┌──────────────────┐
                        │  Order Status    │
                        │  Update          │
                        └──────────────────┘
```

---

## 📡 Endpoints Overview

### Base URL

```
Production: https://your-domain.com/api
Development: http://localhost:3000/api
```

### Available Endpoints

| Method | Endpoint                     | Description              | Auth |
| ------ | ---------------------------- | ------------------------ | ---- |
| POST   | `/payments/initialize`       | Initialize payment       | ✅   |
| GET    | `/payments/:id/status`       | Get payment status       | ✅   |
| POST   | `/payments/verify-email`     | Verify customer email    | ❌   |
| POST   | `/payments/resend-code`      | Resend verification code | ❌   |
| POST   | `/webhooks/:provider`        | Receive payment webhooks | ❌   |
| GET    | `/admin/kpis/overview`       | Dashboard KPIs           | ✅   |
| GET    | `/admin/orders`              | List orders              | ✅   |
| POST   | `/admin/orders/:id/validate` | Validate order           | ✅   |
| POST   | `/admin/orders/:id/complete` | Complete order           | ✅   |

---

## 💵 Payment Endpoints

### 1. Initialize Payment

Create a new payment intention and get redirect URL to payment provider.

```http
POST /api/payments/initialize
Content-Type: application/json
x-api-key: your_api_key
```

#### Request Body

```json
{
  "customerEmail": "customer@example.com",
  "customerName": "John",
  "customerSurname": "Doe",
  "customerPhoneNumber": "+237600000000",
  "customerCity": "Douala",
  "customerCountry": "CM",
  "currency": "XAF",
  "amount": 5000,
  "paymentMethod": "mobile_money",
  "countryCode": "CM",
  "successUrl": "https://yoursite.com/success",
  "cancelUrl": "https://yoursite.com/cancel",
  "lmsItemId": "123",
  "lmsItemType": "course"
}
```

#### Response (Success)

```json
{
  "status": "success",
  "data": {
    "success": true,
    "orderReference": "ORD-ABC123XYZ",
    "paymentIntentId": "123",
    "transactionNumber": "TXN-ABC123",
    "redirectUrl": "https://provider.com/pay/xxx",
    "provider": "cinetpay",
    "clientSecret": "pi_xxx_secret_xxx"
  }
}
```

#### Response (Error)

```json
{
  "status": "fail",
  "data": {
    "success": false,
    "error": "No provider available for this configuration"
  }
}
```

#### Field Descriptions

| Field                 | Required | Type   | Description                         |
| --------------------- | -------- | ------ | ----------------------------------- |
| `customerEmail`       | ✅       | string | Customer email address              |
| `customerName`        | ✅       | string | Customer first name                 |
| `customerSurname`     | ❌       | string | Customer last name                  |
| `customerPhoneNumber` | ❌       | string | Phone number (with country code)    |
| `customerCity`        | ❌       | string | Customer city                       |
| `customerCountry`     | ❌       | string | 2-letter country code (default: CM) |
| `currency`            | ✅       | string | Currency code (XAF, EUR, USD)       |
| `amount`              | ✅       | number | Amount in smallest currency unit    |
| `paymentMethod`       | ✅       | string | `mobile_money`, `card`              |
| `countryCode`         | ✅       | string | Country code for routing            |
| `successUrl`          | ❌       | string | Redirect after success              |
| `cancelUrl`           | ❌       | string | Redirect after cancellation         |
| `lmsItemId`           | ❌       | string | LMS course/package ID               |
| `lmsItemType`         | ❌       | string | `course`, `package`, `subscription` |

---

### 2. Get Payment Status

Check the current status of a payment.

```http
GET /api/payments/:id/status
x-api-key: your_api_key
```

#### Response

```json
{
  "status": "success",
  "data": {
    "id": 123,
    "status": "succeeded",
    "amount": 5000,
    "currency": "XAF",
    "orderReference": "ORD-ABC123XYZ",
    "attempts": [
      {
        "id": 1,
        "provider": "cinetpay",
        "status": "succeeded",
        "createdAt": "2026-02-26T10:00:00Z"
      }
    ]
  }
}
```

---

## 🪝 Webhook Endpoints

### Webhook URL Format

```
Production: https://your-domain.com/api/webhooks/{provider}
Development: http://localhost:3000/api/webhooks/{provider}
```

### Supported Providers

| Provider | Webhook URL              |
| -------- | ------------------------ |
| CinetPay | `/api/webhooks/cinetpay` |
| Stripe   | `/api/webhooks/stripe`   |
| KKiaPay  | `/api/webhooks/kkiapay`  |

### CinetPay Webhook Payload

```json
{
  "event_type": "payment.success",
  "cpm_trans_id": "TXN123456",
  "cpm_result": "00",
  "cpm_amount": "5000",
  "cpm_currency": "XAF",
  "customer_phone_number": "+237600000000",
  "customer_email": "customer@example.com"
}
```

### Stripe Webhook Payload

```json
{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_xxx",
      "payment_status": "paid",
      "amount_total": 5000,
      "metadata": {
        "transactionNumber": "TXN123"
      }
    }
  }
}
```

### KKiaPay Webhook Payload

```json
{
  "event": "transaction.success",
  "transactionId": "TXN123",
  "partnerId": "PARTNER123",
  "amount": 5000,
  "isPaymentSucces": true,
  "status": "success"
}
```

### Webhook Response

Return `200 OK` to acknowledge receipt:

```json
{
  "success": true,
  "eventId": "evt_123"
}
```

---

## 👑 Admin Endpoints

### Authentication

All admin endpoints require an admin-level API key.

```http
GET /api/admin/orders
x-api-key: admin:your_key
```

---

### 1. Dashboard KPIs

```http
GET /api/admin/kpis/overview
```

#### Response

```json
{
  "status": "success",
  "data": {
    "revenue24h": 125000,
    "transactionCount24h": 45,
    "successRate": 92.5,
    "failoverRate": 5.2,
    "failoverCount": 3,
    "trends": {
      "revenue": 12.5,
      "transactions": -3.2
    }
  }
}
```

---

### 2. List Orders

```http
GET /api/admin/orders?page=1&limit=20&status=pending
```

#### Query Parameters

| Parameter      | Type   | Description                  |
| -------------- | ------ | ---------------------------- |
| `page`         | number | Page number (default: 1)     |
| `limit`        | number | Items per page (default: 25) |
| `status`       | string | Filter by status             |
| `search`       | string | Search by reference or email |
| `purchaseType` | string | `self` or `gift`             |
| `dateFrom`     | string | Start date (ISO)             |
| `dateTo`       | string | End date (ISO)               |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 264,
      "reference": "ORD-ABC123XYZ",
      "customerEmail": "customer@example.com",
      "customerName": "John",
      "status": "payment_confirmed",
      "totalAmount": "5000.00",
      "currency": "XAF",
      "createdAt": "2026-02-26T10:00:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "perPage": 20,
    "totalPages": 8
  }
}
```

---

### 3. Get Order Details

```http
GET /api/admin/orders/:id
```

#### Response

```json
{
  "success": true,
  "data": {
    "order": {
      "id": 264,
      "reference": "ORD-ABC123XYZ",
      "customerEmail": "customer@example.com",
      "customerName": "John",
      "customerSurname": "Doe",
      "customerPhone": "+237600000000",
      "customerCity": "Douala",
      "customerCountry": "Cameroun",
      "currency": "XAF",
      "totalAmount": "5000.00",
      "status": "payment_confirmed",
      "purchaseType": "self",
      "lmsItemId": "123",
      "lmsItemType": "course",
      "formationName": "Formation Name",
      "formationPrice": "5000.00",
      "paidAt": "2026-02-26T10:05:00Z",
      "paymentProvider": "cinetpay",
      "transactionReference": "TXN123456",
      "validatedAt": null,
      "completedAt": null,
      "createdAt": "2026-02-26T10:00:00Z"
    },
    "auditHistory": [
      {
        "id": 1,
        "orderId": 264,
        "action": "ORDER_CREATED",
        "actionLabel": "Commande créée",
        "actorType": "api",
        "createdAt": "2026-02-26T10:00:00Z"
      }
    ]
  }
}
```

---

### 4. Validate Order

After payment confirmation, admin validates the order.

```http
POST /api/admin/orders/:id/validate
Content-Type: application/json
x-api-key: admin:your_key
```

#### Request Body

```json
{
  "action": "validate",
  "notes": "Payment verified, documents complete"
}
```

#### Response

```json
{
  "success": true,
  "message": "Commande validée. Email avec facture envoyé.",
  "data": {
    "order": {
      "id": 264,
      "status": "validated",
      "validatedAt": "2026-02-26T10:10:00Z"
    }
  }
}
```

---

### 5. Complete Order (Send Credentials)

Final step - send campus credentials to customer.

```http
POST /api/admin/orders/:id/complete
Content-Type: application/json
x-api-key: admin:your_key
```

#### Request Body

```json
{
  "username": "student.user",
  "password": "TempPass123!"
}
```

#### Response

```json
{
  "success": true,
  "message": "Commande finalisée. Credentials envoyés au client.",
  "data": {
    "order": {
      "id": 264,
      "status": "completed",
      "campusUsername": "student.user",
      "credentialsSentAt": "2026-02-26T10:15:00Z"
    }
  }
}
```

---

### 6. Reject Order

Reject an order (e.g., suspicious payment).

```http
POST /api/admin/orders/:id/validate
Content-Type: application/json
x-api-key: admin:your_key
```

#### Request Body

```json
{
  "action": "reject",
  "notes": "Payment not received, documentation incomplete"
}
```

---

## 🔄 Order Workflow

### Status Flow

```
┌─────────┐     ┌──────────────────┐     ┌────────────┐     ┌───────────┐
│ PENDING │────▶│PAYMENT_CONFIRMED │────▶│ VALIDATED  │────▶│ COMPLETED │
└─────────┘     └──────────────────┘     └────────────┘     └───────────┘
                      │                         │
                      │                         ▼
                      │                   ┌──────────┐
                      └──────────────────▶│ REJECTED │
                                            └──────────┘
```

### Status Descriptions

| Status              | Description                        | Next Status                           |
| ------------------- | ---------------------------------- | ------------------------------------- |
| `pending`           | Order created, waiting for payment | `payment_confirmed`, `payment_failed` |
| `payment_confirmed` | Payment received via webhook       | `validated`, `rejected`               |
| `validated`         | Admin verified the order           | `completed`                           |
| `completed`         | Credentials sent to customer       | (final)                               |
| `payment_failed`    | Payment failed or expired          | (final)                               |
| `rejected`          | Order rejected by admin            | (final)                               |

---

## 📊 Data Models

### Order Object

```typescript
interface Order {
  id: number;
  reference: string; // Unique order reference
  customerEmail: string; // Customer email
  customerName: string; // First name
  customerSurname: string | null; // Last name
  customerPhone: string | null; // Phone number
  customerCity: string | null; // City
  customerCountry: string | null; // Country
  currency: string; // XAF, EUR, USD
  totalAmount: string; // Amount as string
  status: OrderStatus; // Current status
  purchaseType: "self" | "gift"; // Purchase type

  // LMS Fields
  lmsItemId: string | null; // LMS item ID
  lmsItemType: string | null; // course, package, subscription
  formationId: number | null; // Formation ID
  formationName: string | null; // Formation name
  formationPrice: string | null; // Formation price

  // Beneficiary (for gifts)
  beneficiaryEmail: string | null;
  beneficiaryFirstName: string | null;
  beneficiaryLastName: string | null;
  beneficiaryPhone: string | null;
  beneficiaryRelationship: string | null;
  beneficiaryCountry: string | null;

  // Payment Info
  paidAt: string | null; // Payment timestamp
  paymentProvider: string | null; // Provider used
  transactionReference: string | null;

  // Validation
  validatedAt: string | null;
  validatedBy: number | null;
  adminNotes: string | null;
  rejectionReason: string | null;

  // Completion
  completedAt: string | null;
  completedBy: number | null;
  campusUsername: string | null;
  credentialsSentAt: string | null;
  credentialsSentTo: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

### Transaction Object

```typescript
interface Transaction {
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
```

---

## ⚠️ Error Handling

### Error Response Format

```json
{
  "status": "fail",
  "message": "Error description",
  "errors": [
    {
      "field": "customerEmail",
      "message": "Invalid email format"
    }
  ]
}
```

### HTTP Status Codes

| Code  | Meaning      |
| ----- | ------------ |
| `200` | Success      |
| `201` | Created      |
| `400` | Bad Request  |
| `401` | Unauthorized |
| `403` | Forbidden    |
| `404` | Not Found    |
| `500` | Server Error |

### Common Errors

| Error                                        | Description                                |
| -------------------------------------------- | ------------------------------------------ |
| `App identification failed: Missing API Key` | No API key provided                        |
| `App identification failed: Invalid API Key` | Invalid or inactive API key                |
| `Insufficient privileges`                    | Non-admin key accessing admin endpoint     |
| `Order not found`                            | Invalid order ID                           |
| `No provider available`                      | No payment provider for this configuration |

---

## 💻 Integration Examples

### JavaScript / TypeScript

```typescript
// Initialize payment
async function initializePayment(paymentData) {
  const response = await fetch("/api/payments/initialize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "your_api_key",
    },
    body: JSON.stringify(paymentData),
  });

  const data = await response.json();

  if (data.data.success) {
    // Redirect to payment provider
    window.location.href = data.data.redirectUrl;
  } else {
    console.error("Payment failed:", data.data.error);
  }
}
```

### cURL

```bash
# Initialize payment
curl -X POST http://localhost:3000/api/payments/initialize \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key" \
  -d '{
    "customerEmail": "customer@example.com",
    "customerName": "John",
    "currency": "XAF",
    "amount": 5000,
    "paymentMethod": "mobile_money",
    "countryCode": "CM"
  }'
```

### React Query Example

```typescript
import { useMutation } from '@tanstack/react-query';

function PaymentForm() {
  const mutation = useMutation({
    mutationFn: (paymentData) =>
      fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'your_api_key'
        },
        body: JSON.stringify(paymentData)
      }).then(res => res.json())
  });

  const handleSubmit = async (data) => {
    const result = await mutation.mutateAsync(data);
    if (result.data.redirectUrl) {
      window.location.href = result.data.redirectUrl;
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}
```

---

## 🔧 Configuration

### Environment Variables

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=dbs13860932
DATABASE_USER=your_user
DATABASE_PASSWORD=your_password

# Payment Providers
CINETPAY_API_KEY=your_cinetpay_key
CINETPAY_SITE_ID=your_site_id
STRIPE_SECRET_KEY=sk_test_xxx
KKIAPAY_SECRET_KEY=your_kkiapay_key

# Mail
MAIL_HOST=smtp.ionos.fr
MAIL_PORT=465
MAIL_USER=no-reply@yourdomain.com
MAIL_PASS=your_password

# Security
ADMIN_MASTER_KEY=admin:your_secret
JWT_SECRET=your_jwt_secret
```

---

## 📞 Support

For issues or questions:

- Email: support@studiesholding.com
- Dashboard: http://localhost:3001

---

_Last Updated: February 2026_
_Version: 1.0.0_
