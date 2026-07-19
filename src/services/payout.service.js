const mongoose = require('mongoose');
const Merchant = require('../models/merchant.model');
const Payout = require('../models/payout.model');
const LedgerEntry = require('../models/ledger.model');

class PayoutService {
  async requestPayout(merchantId, amount) {
    if (!amount || amount <= 0) {
      throw new Error('Payout amount must be greater than zero');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch merchant
      const merchant = await Merchant.findById(merchantId).session(session);
      if (!merchant) {
        throw new Error('Merchant not found');
      }

      // 2. Validate balance
      if (merchant.availableBalance < amount) {
        throw new Error('Insufficient available balance for payout');
      }

      // 3. Enforce 24-hour limit
      const now = new Date();
      if (merchant.lastWithdrawalAt) {
        const timeDiff = now.getTime() - new Date(merchant.lastWithdrawalAt).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        if (hoursDiff < 24) {
          throw new Error('Only one withdrawal is allowed every 24 hours');
        }
      }

      // 4. Create Payout record (initially PENDING)
      const payout = new Payout({
        merchantId,
        amount,
        status: 'PENDING',
        previousLastWithdrawalAt: merchant.lastWithdrawalAt
      });
      await payout.save({ session });

      // 5. Update Merchant: deduct balance and set new lastWithdrawalAt timestamp
      merchant.availableBalance -= amount;
      merchant.lastWithdrawalAt = now;
      await merchant.save({ session });

      // 6. Write Ledger
      const ledger = new LedgerEntry({
        merchantId,
        amount: -amount,
        type: 'DEBIT',
        category: 'PAYOUT',
        referenceId: payout._id
      });
      await ledger.save({ session });

      await session.commitTransaction();
      session.endSession();

      return payout;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async failPayout(payoutId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch payout
      const payout = await Payout.findById(payoutId).session(session);
      if (!payout) {
        throw new Error('Payout not found');
      }

      if (payout.status !== 'PENDING') {
        throw new Error('Payout is not in PENDING state');
      }

      // 2. Fetch merchant
      const merchant = await Merchant.findById(payout.merchantId).session(session);
      if (!merchant) {
        throw new Error('Merchant not found');
      }

      // 3. Update Payout status
      payout.status = 'FAILED';
      await payout.save({ session });

      // 4. Update Merchant: refund balance and restore previous withdrawal time
      merchant.availableBalance += payout.amount;
      merchant.lastWithdrawalAt = payout.previousLastWithdrawalAt;
      await merchant.save({ session });

      // 5. Create Ledger Entry for refund/reversal
      const ledger = new LedgerEntry({
        merchantId: payout.merchantId,
        amount: payout.amount,
        type: 'CREDIT',
        category: 'PAYOUT_REVERT',
        referenceId: payout._id
      });
      await ledger.save({ session });

      await session.commitTransaction();
      session.endSession();

      return payout;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

module.exports = new PayoutService();
