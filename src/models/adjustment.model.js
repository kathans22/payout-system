const mongoose = require('mongoose');

const adjustmentSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  amount: { type: Number, required: true }, // in cents (can be negative for refunds, positive for promotional credits, etc.)
  type: { type: String, enum: ['REFUND', 'DISPUTE', 'MANUAL_CREDIT', 'MANUAL_DEBIT'], required: true },
  description: { type: String, required: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, index: true }, // optional, e.g. ref to a Sale or Payout
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Adjustment', adjustmentSchema);
