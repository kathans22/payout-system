# Payout System with Affiliate Sale Advance & Reconciliation

A robust, audit-ready financial backend system designed to handle affiliate sale lifecycles, background advance payouts (10% of pending sales), admin approval/rejection reconciliation, and pacing of balance withdrawals. Built with Node.js, Express.js, and MongoDB + Mongoose, utilizing database transactions to guarantee absolute financial consistency.

---

## Core Specifications & Rules

1. **Sale Lifecycle**:
   - Every affiliate sale starts as `PENDING`.
   - A background processor runs exactly once per sale to pay out a **10% advance** of sale earnings (idempotency enforced).
   - An admin later reconciles the sale to either:
     - **APPROVED**: The user is paid the remaining earnings (`amount - advancePaid` / 90% of sale amount).
     - **REJECTED**: The advance already paid is clawed back via a negative adjustment (`-advancePaid`) against the user's withdrawable balance (can drive the balance negative).

2. **24-Hour Withdrawal Throttle**:
   - A merchant can request only **one withdrawal payout every 24 hours**.

3. **Processor Failure Recovery**:
   - If a payout processor reports a withdrawal failure (processor level), the balance is refunded and the merchant's previous withdrawal eligibility timestamp is restored, allowing them to retry immediately.

4. **Ledger Auditing**:
   - Implements an immutable double-entry style ledger. The merchant's system balance is guaranteed to equal the sum of their ledger entries.

---

## Directory Structure

```text
Payout/
├── package.json
├── jest.config.js
├── .env
├── src/
│   ├── app.js               # Express application config & error middleware
│   ├── server.js            # Main entrypoint
│   ├── config/
│   │   └── database.js      # MongoDB connector
│   ├── controllers/         # Request controllers
│   ├── models/              # Mongoose DB Schemas
│   ├── routes/              # Express API Route mappings
│   └── services/            # Transactional business logic (Service Layer)
└── tests/
    ├── setup.js             # MongoMemoryReplSet hook & index setup
    └── integration/         # Integration specs (money-math & routing)
```

---

## Database Schemas

### 1. Merchant / User (`merchants`)
*   `name` (String, required)
*   `email` (String, unique, indexed)
*   `availableBalance` (Number, cents, default `0`) - withdrawable balance.
*   `lastWithdrawalAt` (Date, default `null`) - timestamp of last withdrawal.

### 2. Sale (`sales`)
*   `merchantId` (ObjectId ref Merchant, indexed)
*   `amount` (Number, cents) - total sale amount.
*   `advancePaid` (Number, cents, default `0`) - advance paid amount.
*   `advanceProcessed` (Boolean, default `false`) - idempotency flag.
*   `advancePaidAt` (Date, default `null`)
*   `status` (String: `'PENDING'`, `'APPROVED'`, `'REJECTED'`, default `'PENDING'`)
*   `reconciledAt` (Date, default `null`)

### 3. Payout (`payouts`)
*   `merchantId` (ObjectId ref Merchant, indexed)
*   `amount` (Number, cents)
*   `status` (String: `'PENDING'`, `'PAID'`, `'FAILED'`, default `'PENDING'`)
*   `previousLastWithdrawalAt` (Date, default `null`) - caches prior timestamp to restore on failure.

### 4. LedgerEntry (`ledger_entries`)
*   `merchantId` (ObjectId ref Merchant, indexed)
*   `amount` (Number, cents, signed)
*   `type` (String: `'CREDIT'`, `'DEBIT'`)
*   `category` (String: `'ADVANCE_PAYOUT'`, `'RECONCILIATION'`, `'ADJUSTMENT'`, `'PAYOUT'`, `'PAYOUT_REVERT'`)
*   `referenceId` (ObjectId, required) - source event.

---

## API Endpoints

### 1. User & Ledger APIs
*   `POST /api/merchants`: Create a new user/merchant.
*   `GET /api/merchants/:id`: Retrieve user profile and balances.
*   `GET /api/merchants/:id/ledger`: Retrieve ledger log history.

### 2. Transactions & Jobs APIs
*   `POST /api/sales`: Create a new `PENDING` sale.
*   `POST /api/advances/process`: Trigger background job to process 10% advances.
*   `POST /api/sales/:id/reconcile`: Admin reconciles sale to `APPROVED` or `REJECTED`.
*   `POST /api/payouts`: Create a payout withdrawal (enforces 24-hour limit).
*   `POST /api/payouts/:id/fail`: Processor reports failure (refunds balance, restores eligibility).

---

## Getting Started

### Prerequisites
- Node.js (v18+)

### Installation
1. Install packages:
   ```bash
   npm install
   ```
2. Configure `.env` file at the root:
   ```text
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/payout_system
   ```

### Run Tests
Executes the in-memory transaction and math checks:
```bash
npm run test
```

### Start Server
```bash
npm run dev
```
