const saleService = require('../services/saleService');
const LedgerEntry = require('../models/ledger.model');

exports.recordSale = async (req, res, next) => {
  try {
    const { userId, brandId, earningPaise } = req.body;
    if (!userId || !brandId) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'userId and brandId are required' } });
    }

    const sale = await saleService.recordSale(userId, brandId, earningPaise);
    res.status(201).json({
      saleId: sale._id,
      status: sale.status,
      earningINR: sale.earningPaise / 100
    });
  } catch (error) {
    next(error);
  }
};

exports.reconcileSale = async (req, res, next) => {
  try {
    const { status, finalEarningPaise } = req.body;
    const { id } = req.params;

    const sale = await saleService.reconcileSale(id, status, finalEarningPaise);

    // Fetch advance entry if exists to compute exact remaining/adjustment values
    const advanceEntry = await LedgerEntry.findOne({ saleId: sale._id, type: 'ADVANCE' });
    const advancePaid = advanceEntry ? advanceEntry.amountPaise : 0;

    if (status === 'approved') {
      const remainingPaid = sale.earningPaise - advancePaid;
      res.status(200).json({
        saleId: sale._id,
        status: sale.status,
        remainingPaidINR: remainingPaid / 100
      });
    } else {
      res.status(200).json({
        saleId: sale._id,
        status: sale.status,
        adjustmentINR: -advancePaid / 100
      });
    }
  } catch (error) {
    next(error);
  }
};
