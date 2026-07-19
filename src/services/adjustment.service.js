const mongoose = require('mongoose');
const Merchant = require('../models/merchant.model');
const Adjustment = require('../models/adjustment.model');
const LedgerEntry = require('../models/ledger.model');

class AdjustmentService {
  async createAdjustment(merchantId, amount, type, description, referenceId = null) {
    if (!amount || amount === 0) {
      throw new Error('Adjustment amount cannot be zero');
    }
    if (!type || !description) {
      throw new Error('Type and description are required for adjustments');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch merchant
      const merchant = await Merchant.findById(merchantId).session(session);
      if (!merchant) {
        throw new Error('Merchant not found');
      }

      // 2. Create Adjustment record
      const adjustment = new Adjustment({
        merchantId,
        amount,
        type,
        description,
        referenceId
      });
      await adjustment.save({ session });

      // 3. Update Merchant available balance (can go negative)
      merchant.availableBalance += amount;
      await merchant.save({ session });

      // 4. Create Ledger Entry
      const ledgerEntry = new LedgerEntry({
        merchantId,
        amount,
        type: amount > 0 ? 'CREDIT' : 'DEBIT',
        category: 'ADJUSTMENT',
        referenceId: adjustment._id
      });
      await ledgerEntry.save({ session });

      await session.commitTransaction();
      session.endSession();

      return adjustment;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

module.exports = new AdjustmentService();
