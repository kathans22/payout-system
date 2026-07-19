const advanceService = require('../services/advance.service');

exports.requestAdvance = async (req, res, next) => {
  try {
    const result = await advanceService.processPendingAdvances();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
