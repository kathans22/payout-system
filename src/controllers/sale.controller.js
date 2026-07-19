const saleService = require('../services/sale.service');

exports.recordSale = async (req, res, next) => {
  try {
    const { merchantId, amount } = req.body;
    if (!merchantId) {
      return res.status(400).json({ error: 'merchantId is required' });
    }
    const sale = await saleService.recordSale(merchantId, amount);
    res.status(201).json({
      saleId: sale._id,
      merchantId: sale.merchantId,
      amount: sale.amount,
      advancePaid: sale.advancePaid,
      status: sale.status
    });
  } catch (error) {
    next(error);
  }
};

exports.reconcileSale = async (req, res, next) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    const sale = await saleService.reconcileSale(id, status);
    
    if (status === 'APPROVED') {
      res.status(200).json({
        saleId: sale._id,
        status: sale.status,
        remainingEarned: sale.amount - sale.advancePaid
      });
    } else {
      res.status(200).json({
        saleId: sale._id,
        status: sale.status,
        adjustmentAmount: -sale.advancePaid
      });
    }
  } catch (error) {
    next(error);
  }
};
