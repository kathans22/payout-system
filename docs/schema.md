# Mongoose Database Schemas & Relationships

This document contains the detailed Mongoose schema definitions, field validation constraints, default values, and reference mappings for the Payout System collections.

---

## 1. User Schema (`users`)
Represents the user/affiliate account. Appends new users and maintains standard tracking properties. No balances are stored redundantly.

```javascript
const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'User name is required'] 
  },
  email: { 
    type: String, 
    required: [true, 'User email is required'], 
    unique: true, 
    index: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});
```

---

## 2. Brand Schema (`brands`)
Reference lookup collection for merchant brands. Shared data referenced by sales.

```javascript
const BrandSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Brand name is required'] 
  }
});
```

---

## 3. Sale Schema (`sales`)
Documents each individual affiliate sale. References the associated `User` and `Brand`.

```javascript
const SaleSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'User ID reference is required'],
    index: true 
  },
  brandId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Brand', 
    required: [true, 'Brand ID reference is required'],
    index: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending', 
    index: true 
  },
  earningPaise: { 
    type: Number, 
    required: [true, 'Earning amount in paise is required'],
    validate: {
      validator: function(value) {
        return value > 0;
      },
      message: 'Sale earning must be greater than zero.'
    }
  },
  reconciledAt: { 
    type: Date, 
    default: null 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});
```

---

## 4. Ledger Entry Schema (`ledger_entries`)
Immutable general ledger entries tracking credits and debits.

```javascript
const LedgerEntrySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'User ID reference is required'],
    index: true 
  },
  saleId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Sale', 
    default: null,
    index: true
  },
  type: { 
    type: String, 
    enum: ['ADVANCE', 'FINAL_SETTLEMENT', 'ADJUSTMENT', 'WITHDRAWAL', 'REVERSAL'], 
    required: [true, 'Ledger entry type is required'] 
  },
  amountPaise: { 
    type: Number, 
    required: [true, 'Amount in paise is required'] 
  },
  referenceId: { 
    type: String, 
    default: null,
    index: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Idempotency constraint index: Only one advance ledger entry can be inserted per sale
LedgerEntrySchema.index(
  { saleId: 1, type: 1 },
  { 
    unique: true, 
    partialFilterExpression: { type: 'ADVANCE' } 
  }
);

// Performance index for dynamic balance calculation matching
LedgerEntrySchema.index({ userId: 1 });

// Performance index for ledger history queries and getLastWithdrawal query
LedgerEntrySchema.index({ userId: 1, createdAt: -1 });
```

---

## 5. Payout Schema (`payouts`)
Manages standard payout withdrawal request lifecycle events.

```javascript
const PayoutSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'User ID reference is required'],
    index: true 
  },
  amountPaise: { 
    type: Number, 
    required: [true, 'Payout amount in paise is required'] 
  },
  status: { 
    type: String, 
    enum: ['initiated', 'completed', 'failed', 'cancelled'], 
    default: 'initiated',
    index: true 
  },
  initiatedAt: { 
    type: Date, 
    default: Date.now 
  },
  resolvedAt: { 
    type: Date, 
    default: null 
  }
});

// Index to query active/failed user payouts
PayoutSchema.index({ userId: 1, status: 1 });
```
