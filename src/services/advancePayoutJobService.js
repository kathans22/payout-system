const mongoose = require('mongoose');
const Sale = require('../models/sale.model');
const LedgerEntry = require('../models/ledger.model');

class AdvancePayoutJobService {
  async processPendingAdvances() {
    // 1. Find all pending sales
    const pendingSales = await Sale.find({ status: 'pending' });

    let processedCount = 0;
    let totalAdvancePaid = 0;

    for (const sale of pendingSales) {
      // Optimistic pre-check to avoid unnecessary transactions
      const existing = await LedgerEntry.findOne({ saleId: sale._id, type: 'ADVANCE' });
      if (existing) {
        continue;
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Calculate 10% advance payout (in paise)
        const advanceAmount = Math.round(sale.earningPaise * 0.10);

        const ledger = new LedgerEntry({
          userId: sale.userId,
          saleId: sale._id,
          type: 'ADVANCE',
          amountPaise: advanceAmount
        });

        await ledger.save({ session });

        await session.commitTransaction();
        session.endSession();

        processedCount++;
        totalAdvancePaid += advanceAmount;
      } catch (error) {
        await session.abortTransaction();
        session.endSession();

        // Catch duplicate key error (code 11000) and treat as a no-op
        if (error.code === 11000 || (error.writeErrors && error.writeErrors.some(e => e.code === 11000))) {
          console.log(`Duplicate advance payout blocked for sale ${sale._id}`);
        } else {
          console.error(`Error processing advance for sale ${sale._id}:`, error.message);
        }
      }
    }

    return {
      processedCount,
      totalAdvancePaid
    };
  }
}

module.exports = new AdvancePayoutJobService();
