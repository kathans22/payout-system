const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amountPaise: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['initiated', 'completed', 'failed', 'cancelled'], 
    default: 'initiated' 
  },
  initiatedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null }
});

payoutSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Payout', payoutSchema);
