const merchantService = require('../services/merchant.service');

exports.createMerchant = async (req, res, next) => {
  try {
    const merchant = await merchantService.createMerchant(req.body);
    res.status(201).json({
      id: merchant._id,
      name: merchant.name,
      email: merchant.email,
      availableBalance: merchant.availableBalance,
      outstandingAdvance: merchant.outstandingAdvance
    });
  } catch (error) {
    next(error);
  }
};

exports.getMerchant = async (req, res, next) => {
  try {
    const merchant = await merchantService.getMerchantById(req.params.id);
    res.status(200).json({
      id: merchant._id,
      name: merchant.name,
      email: merchant.email,
      availableBalance: merchant.availableBalance,
      outstandingAdvance: merchant.outstandingAdvance
    });
  } catch (error) {
    next(error);
  }
};

exports.getLedger = async (req, res, next) => {
  try {
    const entries = await merchantService.getLedgerEntries(req.params.id);
    res.status(200).json(
      entries.map(entry => ({
        id: entry._id,
        merchantId: entry.merchantId,
        amount: entry.amount,
        type: entry.type,
        category: entry.category,
        referenceId: entry.referenceId,
        createdAt: entry.createdAt
      }))
    );
  } catch (error) {
    next(error);
  }
};
