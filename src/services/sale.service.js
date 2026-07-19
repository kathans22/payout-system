const mongoose = require('mongoose');
const Merchant = require('../models/merchant.model');
const Sale = require('../models/sale.model');
const LedgerEntry = require('../models/ledger.model');
const Adjustment = require('../models/adjustment.model');

class SaleService {
  async recordSale(merchantId, amount) {
    if (!amount || amount <= 0) {
      throw new Error('Sale amount must be greater than zero');
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      throw new Error('Merchant not found');
    }

    const sale = new Sale({
      merchantId,
      amount,
      status: 'PENDING'
    });

    return await sale.save();
  }

  async reconcileSale(saleId, status) {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new Error('Invalid status for reconciliation');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch sale
      const sale = await Sale.findById(saleId).session(session);
      if (!sale) {
        throw new Error('Sale not found');
      }

      if (sale.status !== 'PENDING') {
        throw new Error('Sale has already been reconciled');
      }

      // 2. Fetch merchant
      const merchant = await Merchant.findById(sale.merchantId).session(session);
      if (!merchant) {
        throw new Error('Merchant not found');
      }

      if (status === 'APPROVED') {
        const remainingEarnings = sale.amount - sale.advancePaid;

        // Credit available balance by remaining earnings
        merchant.availableBalance += remainingEarnings;
        await merchant.save({ session });

        // Update sale
        sale.status = 'APPROVED';
        sale.reconciledAt = new Date();
        await sale.save({ session });

        // Write Ledger
        const ledger = new LedgerEntry({
          merchantId: sale.merchantId,
          amount: remainingEarnings,
          type: 'CREDIT',
          category: 'RECONCILIATION',
          referenceId: sale._id
        });
        await ledger.save({ session });
      } else if (status === 'REJECTED') {
        const adjustmentAmount = -sale.advancePaid;

        // Debit available balance (creates a negative line item, can go negative)
        merchant.availableBalance += adjustmentAmount;
        await merchant.save({ session });

        // Update sale
        sale.status = 'REJECTED';
        sale.reconciledAt = new Date();
        await sale.save({ session });

        // Create adjustment record
        const adjustment = new Adjustment({
          merchantId: sale.merchantId,
          amount: adjustmentAmount,
          type: 'REFUND',
          description: `Adjustment for rejected sale #${sale._id}`,
          referenceId: sale._id
        });
        await adjustment.save({ session });

        // Write Ledger
        const ledger = new LedgerEntry({
          merchantId: sale.merchantId,
          amount: adjustmentAmount,
          type: 'DEBIT',
          category: 'ADJUSTMENT',
          referenceId: sale._id
        });
        await ledger.save({ session });
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
