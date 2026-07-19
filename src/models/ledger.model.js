const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  amount: { type: Number, required: true }, // in cents (positive for credit, negative for debit)
  type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
  category: { type: String, enum: ['ADVANCE_PAYOUT', 'RECONCILIATION', 'ADJUSTMENT', 'PAYOUT', 'PAYOUT_REVERT'], required: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, // references Sale, Payout, etc.
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
