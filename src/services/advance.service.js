const mongoose = require('mongoose');
const Sale = require('../models/sale.model');
const Merchant = require('../models/merchant.model');
const LedgerEntry = require('../models/ledger.model');

class AdvanceService {
  async processPendingAdvances() {
    // 1. Fetch all pending sales that have not had an advance processed yet
    const pendingSales = await Sale.find({
      status: 'PENDING',
      advanceProcessed: false
    });

    let processedCount = 0;
    let totalAdvancePaid = 0;

    for (const sale of pendingSales) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Re-verify under session/lock to enforce idempotency strictly
        const lockedSale = await Sale.findById(sale._id).session(session);
        if (!lockedSale || lockedSale.status !== 'PENDING' || lockedSale.advanceProcessed) {
          await session.commitTransaction();
          session.endSession();
          continue; // Skip if already processed or not pending
        }

        const merchant = await Merchant.findById(lockedSale.merchantId).session(session);
        if (!merchant) {
          throw new Error(`Merchant not found for sale ${lockedSale._id}`);
        }

        // Calculate 10% advance payout
        const advanceAmount = Math.round(lockedSale.amount * 0.10);

        // Update Sale
        lockedSale.advancePaid = advanceAmount;
        lockedSale.advanceProcessed = true;
        lockedSale.advancePaidAt = new Date();
        await lockedSale.save({ session });

        // Update Merchant
        merchant.availableBalance += advanceAmount;
        await merchant.save({ session });

        // Create Ledger Entry
        const ledger = new LedgerEntry({
          merchantId: lockedSale.merchantId,
          amount: advanceAmount,
          type: 'CREDIT',
          category: 'ADVANCE_PAYOUT',
          referenceId: lockedSale._id
        });
        await ledger.save({ session });

        await session.commitTransaction();
        session.endSession();

        processedCount++;
        totalAdvancePaid += advanceAmount;
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(`Failed to process advance for sale ${sale._id}:`, error);
      }
    }

    return {
      processedCount,
      totalAdvancePaid
    };
  }
}

module.exports = new AdvanceService();
