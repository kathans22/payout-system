# Payout System with Affiliate Sale Advance & Reconciliation

A robust, audit-ready financial backend system designed to handle affiliate sale lifecycles, background advance payouts (10% of pending sales), admin approval/rejection reconciliation, and balance withdrawals. 

Built with Node.js, Express.js, and MongoDB + Mongoose, utilizing replica set transaction sessions to guarantee absolute financial consistency.

---

## 🚀 Public Repository Link
- GitHub Repository: [https://github.com/kathans22/payout-system](https://github.com/kathans22/payout-system)

---

## 📁 Directory Structure

```text
Payout/
├── docs/
│   ├── LLD.md               # Narrative LLD, ER diagram, and ₹120 -> ₹68 scenario trace
│   ├── schema.md            # Formal Mongoose model definitions & references
│   ├── api.md               # REST API contract definitions & payload examples
│   └── eraser_diagram.txt   # Eraser.io Low-Level System Diagram specification code
├── src/
│   ├── app.js               # Express application configuration & error middleware
│   ├── server.js            # Main entrypoint
│   ├── config/
│   │   └── database.js      # MongoDB database loopback connector
│   ├── controllers/         # REST API request handlers
│   ├── models/              # Mongoose DB models (User, Brand, Sale, LedgerEntry, Payout)
│   ├── routes/              # Express API Route mappings
│   └── services/            # Transactional business logic (Service Layer)
└── tests/
    ├── setup.js             # MongoMemoryReplSet hook & index setup
    └── integration/         # Integration specs (money-math & routing)
```

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Replica Set running locally (only needed for manual local testing, in-memory MongoDB Replica Set is used during Jest tests)

### Installation
1. Install all required dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` configuration file in the project root:
   ```text
   PORT=3000
   MONGO_URI=mongodb://127.0.0.1:27017/payout_system
   ```

### Running Tests
Execute the Jest integration test suite (runs with an in-memory replica set and tests the money-math logic, reconciliation, rollback, and 24h limits):
```bash
npm test
```

### Running Server Locally
Start the development server:
```bash
npm run dev
```

---

## 💡 Design Decisions & Trade-Offs

### 1. Ledger-Based Balance vs. Mutable Counter
- **Decision**: The system uses an immutable, append-only double-entry style ledger. Available balance is calculated dynamically on-the-fly using a MongoDB aggregation pipeline (`$match` + `$group/$sum` over the `amountPaise` field on `ledger_entries`). The User profile stores no cached balances.
- **Trade-off / Rationale**: While compiling the balance from the ledger requires database reads rather than simply reading a pre-computed counter, it prevents race conditions, balance drift, and double-spend vulnerabilities. Most importantly, it creates a bulletproof audit trail where every paise change is linked to a concrete source event.

### 2. Referencing vs. Embedding (DB Modeling)
- **Decision**: Every entity (`User`, `Brand`, `Sale`, `LedgerEntry`, and `Payout`) is modeled as its own top-level collection referencing each other via Mongoose ObjectIds, completely avoiding nested or embedded sub-documents.
- **Trade-off / Rationale**: Embedding documents makes reads extremely fast but introduces limitations:
  1. MongoDB documents have a hard 16MB limit, which an active user's transaction/ledger list would quickly exceed.
  2. Embeddings complicate querying data across users or brands (e.g. background job querying all pending sales). 
  Using top-level collections with explicit referencing guarantees scalability, indexability, and clean ACID transaction boundaries.

### 3. Integers in Paise vs. Floating Point Numbers
- **Decision**: All financial figures (earnings, settlements, adjustments, withdrawals, refunds) are handled as **signed integers in paise** (₹1 = 100 paise) across services, database validations, and queries. Values are only divided by 100 to convert to Rupees (`INR`) at the API controller response boundary.
- **Trade-off / Rationale**: Floating-point types in Javascript and databases suffer from binary rounding errors (e.g., `0.1 + 0.2 === 0.30000000000000004`). In financial ledgers, even tiny rounding inaccuracies accumulate into massive bookkeeping errors. Storing integers in paise guarantees absolute mathematical precision.

### 4. Idempotency at the Database Layer
- **Decision**: Enforced via a unique compound index on `LedgerEntry` `{ saleId: 1, type: 1 }` with a partial filter expression `{ type: 'ADVANCE' }`.
- **Trade-off / Rationale**: In-memory checks are vulnerable to concurrency issues (two cron job processes running simultaneously). By shifting constraint verification to the database layer, MongoDB itself rejects duplicate advance payouts, while the service catches the `11000` duplicate key error and handles it silently as a no-op.
