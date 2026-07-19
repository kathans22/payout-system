const mongoose = require('mongoose');
const Payout = require('../models/payout.model');
const LedgerEntry = require('../models/ledger.model');
const LedgerService = require('./ledgerService');
const WithdrawalService = require('./withdrawalService');
const User = require('../models/user.model');

class PayoutService {
  async requestPayout(userId, amountPaise) {
    if (amountPaise === undefined || amountPaise === null || amountPaise <= 0) {
      const err = new Error('Withdrawal amount must be greater than zero');
      err.status = 400;
      err.code = 'INVALID_AMOUNT';
      throw err;
    }

    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 1. Verify user has enough balance (derived dynamically from ledger)
    const currentBalance = await LedgerService.getWithdrawableBalance(userId);
    if (currentBalance < amountPaise) {
      const err = new Error('Insufficient balance for withdrawal');
      err.status = 400;
      err.code = 'INSUFFICIENT_BALANCE';
      throw err;
    }

    // 2. Enforce 24-hour withdrawal throttle
    const lastWithdrawal = await WithdrawalService.getLastWithdrawalAt(userId);
    if (lastWithdrawal) {
      const elapsedMs = Date.now() - new Date(lastWithdrawal).getTime();
      const hoursElapsed = elapsedMs / (1000 * 60 * 60);
      if (hoursElapsed < 24) {
        const remainingSeconds = Math.ceil((24 * 60 * 60 * 1000 - elapsedMs) / 1000);
        const err = new Error('Only one withdrawal is allowed every 24 hours');
        err.status = 429;
        err.code = 'WITHDRAWAL_LOCKED';
        err.retryAfter = remainingSeconds;
        throw err;
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Re-verify balance inside transaction session
      const currentBalanceSession = await LedgerService.getWithdrawableBalance(userId);
      if (currentBalanceSession < amountPaise) {
        const err = new Error('Insufficient balance for withdrawal');
        err.status = 400;
        err.code = 'INSUFFICIENT_BALANCE';
        throw err;
      }

      // 3. Create Payout record
      const payout = new Payout({
        userId,
        amountPaise,
        status: 'initiated'
      });
      await payout.save({ session });

      // 4. Create LedgerEntry for Withdrawal (negative amount)
      const ledgerEntry = new LedgerEntry({
        userId,
        saleId: null,
        type: 'WITHDRAWAL',
        amountPaise: -amountPaise,
        referenceId: payout._id.toString()
      });
      await ledgerEntry.save({ session });

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
        const err = new Error('Payout not found');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }

      if (payout.status !== 'initiated') {
        const err = new Error('Payout is not in initiated state');
        err.status = 400;
        err.code = 'PAYOUT_ALREADY_RESOLVED';
        throw err;
      }

      // 2. Mark payout failed
      payout.status = 'failed';
      payout.resolvedAt = new Date();
      await payout.save({ session });

      // 3. Write compensating LedgerEntry (+amount) of type REVERSAL
      const reversalLedger = new LedgerEntry({
        userId: payout.userId,
        saleId: null,
        type: 'REVERSAL',
        amountPaise: payout.amountPaise,
        referenceId: payout._id.toString()
      });
      await reversalLedger.save({ session });

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
