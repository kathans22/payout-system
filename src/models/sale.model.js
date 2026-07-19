const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  amount: { type: Number, required: true }, // in cents
  advancePaid: { type: Number, required: true, default: 0 }, // in cents
  advanceProcessed: { type: Boolean, required: true, default: false },
  advancePaidAt: { type: Date, default: null },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
  reconciledAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sale', saleSchema);
