const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  earningPaise: { type: Number, required: true },
  reconciledAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Custom validation for positive earnings
saleSchema.path('earningPaise').validate(function(value) {
  return value > 0;
}, 'Sale earning must be greater than zero.');

module.exports = mongoose.model('Sale', saleSchema);
