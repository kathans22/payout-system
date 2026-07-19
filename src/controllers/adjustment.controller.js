const adjustmentService = require('../services/adjustment.service');

exports.createAdjustment = async (req, res, next) => {
  try {
    const { merchantId, amount, type, description, referenceId } = req.body;
    if (!merchantId) {
      return res.status(400).json({ error: 'merchantId is required' });
    }
    const adjustment = await adjustmentService.createAdjustment(merchantId, amount, type, description, referenceId);
    res.status(201).json({
      adjustmentId: adjustment._id,
      merchantId: adjustment.merchantId,
      amount: adjustment.amount,
      type: adjustment.type,
      description: adjustment.description,
      referenceId: adjustment.referenceId
    });
  } catch (error) {
    next(error);
  }
};
