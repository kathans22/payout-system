const payoutService = require('../services/payout.service');

exports.requestPayout = async (req, res, next) => {
  try {
    const { merchantId, amount } = req.body;
    if (!merchantId) {
      return res.status(400).json({ error: 'merchantId is required' });
    }
    const payout = await payoutService.requestPayout(merchantId, amount);
    res.status(201).json({
      payoutId: payout._id,
      merchantId: payout.merchantId,
      amount: payout.amount,
      status: payout.status
    });
  } catch (error) {
    next(error);
  }
};

exports.failPayout = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payout = await payoutService.failPayout(id);
    res.status(200).json({
      payoutId: payout._id,
      status: payout.status,
      refundedAmount: payout.amount
    });
  } catch (error) {
    next(error);
  }
};
