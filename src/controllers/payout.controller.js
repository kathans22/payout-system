const payoutService = require('../services/payoutService');

exports.failPayout = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payout = await payoutService.failPayout(id);
    res.status(200).json({
      payoutId: payout._id,
      status: payout.status,
      refundedINR: payout.amountPaise / 100
    });
  } catch (error) {
    next(error);
  }
};
