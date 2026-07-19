const mongoose = require('mongoose');
const LedgerEntry = require('../models/ledger.model');

class LedgerService {
  async getWithdrawableBalance(userId) {
    const result = await LedgerEntry.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, balance: { $sum: '$amountPaise' } } }
    ]);
    return result.length > 0 ? result[0].balance : 0;
  }

  async getLedgerEntries(userId, limit = 50, offset = 0) {
    return await LedgerEntry.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));
  }
}

module.exports = new LedgerService();
