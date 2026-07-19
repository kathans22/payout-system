const advancePayoutJobService = require('../services/advancePayoutJobService');

exports.requestAdvance = async (req, res, next) => {
  try {
    const result = await advancePayoutJobService.processPendingAdvances();
    res.status(200).json({
      processedCount: result.processedCount,
      totalAdvancePaidINR: result.totalAdvancePaid / 100
    });
  } catch (error) {
    next(error);
  }
};
