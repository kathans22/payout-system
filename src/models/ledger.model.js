const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
  type: { 
    type: String, 
    enum: ['ADVANCE', 'FINAL_SETTLEMENT', 'ADJUSTMENT', 'WITHDRAWAL', 'REVERSAL'], 
    required: true 
  },
  amountPaise: { type: Number, required: true },
  referenceId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Idempotency compound partial index
ledgerEntrySchema.index(
  { saleId: 1, type: 1 },
  { 
    unique: true, 
    partialFilterExpression: { type: 'ADVANCE' } 
  }
);

// Performance index for ledger history and getLastWithdrawal
ledgerEntrySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
