const mongoose = require('mongoose');
const Sale = require('../models/sale.model');
const LedgerEntry = require('../models/ledger.model');
const User = require('../models/user.model');
const Brand = require('../models/brand.model');

class SaleService {
  async recordSale(userId, brandId, earningPaise) {
    if (earningPaise === undefined || earningPaise === null || earningPaise <= 0) {
      const err = new Error('Sale earning must be greater than zero');
      err.status = 400;
      err.code = 'INVALID_EARNINGS';
      throw err;
    }

    const userExists = await User.findById(userId);
    if (!userExists) {
      const err = new Error('User not found');
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const brandExists = await Brand.findById(brandId);
    if (!brandExists) {
      const err = new Error('Brand not found');
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const sale = new Sale({
      userId,
      brandId,
      earningPaise,
      status: 'pending'
    });

    return await sale.save();
  }

  async reconcileSale(saleId, status, finalEarningPaise = null) {
    if (!['approved', 'rejected'].includes(status)) {
      const err = new Error('Invalid status for reconciliation');
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch sale
      const sale = await Sale.findById(saleId).session(session);
      if (!sale) {
        const err = new Error('Sale not found');
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }

      if (sale.status !== 'pending') {
        const err = new Error('Sale has already been reconciled');
        err.status = 409;
        err.code = 'ALREADY_RECONCILED';
        throw err;
      }

      // 2. Fetch advance payment in ledger
      const advanceEntry = await LedgerEntry.findOne({ saleId: sale._id, type: 'ADVANCE' }).session(session);
      const advancePaid = advanceEntry ? advanceEntry.amountPaise : 0;

      if (status === 'approved') {
        const finalEarnings = finalEarningPaise !== null && finalEarningPaise !== undefined ? finalEarningPaise : sale.earningPaise;
        if (finalEarnings <= 0) {
          const err = new Error('Approved earning must be greater than zero');
          err.status = 400;
          err.code = 'INVALID_EARNINGS';
          throw err;
        }

        const remainingPaid = finalEarnings - advancePaid;

        // Save ledger entry if not zero
        if (remainingPaid !== 0) {
          const settlementLedger = new LedgerEntry({
            userId: sale.userId,
            saleId: sale._id,
            type: 'FINAL_SETTLEMENT',
            amountPaise: remainingPaid
          });
          await settlementLedger.save({ session });
        }

        sale.status = 'approved';
        sale.earningPaise = finalEarnings;
        sale.reconciledAt = new Date();
        await sale.save({ session });
      } else if (status === 'rejected') {
        const adjustmentAmount = -advancePaid;

        if (adjustmentAmount !== 0) {
          const adjustmentLedger = new LedgerEntry({
            userId: sale.userId,
            saleId: sale._id,
            type: 'ADJUSTMENT',
            amountPaise: adjustmentAmount
          });
          await adjustmentLedger.save({ session });
        }

        sale.status = 'rejected';
        sale.reconciledAt = new Date();
        await sale.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      return sale;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

module.exports = new SaleService();
