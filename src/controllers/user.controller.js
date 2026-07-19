const User = require('../models/user.model');
const ledgerService = require('../services/ledgerService');
const payoutService = require('../services/payoutService');

exports.createUser = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Name and email are required' } });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'User with this email already exists' } });
    }

    const user = new User({ name, email });
    await user.save();

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      balanceINR: 0.00
    });
  } catch (error) {
    next(error);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const balancePaise = await ledgerService.getWithdrawableBalance(user._id);
    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      balanceINR: balancePaise / 100
    });
  } catch (error) {
    next(error);
  }
};

exports.getBalance = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const balancePaise = await ledgerService.getWithdrawableBalance(user._id);
    res.status(200).json({
      userId: user._id,
      balanceINR: balancePaise / 100
    });
  } catch (error) {
    next(error);
  }
};

exports.getLedger = async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const entries = await ledgerService.getLedgerEntries(req.params.id, limit, offset);
    res.status(200).json(
      entries.map(entry => ({
        id: entry._id,
        saleId: entry.saleId,
        type: entry.type,
        amountINR: entry.amountPaise / 100,
        referenceId: entry.referenceId,
        createdAt: entry.createdAt
      }))
    );
  } catch (error) {
    next(error);
  }
};

exports.withdraw = async (req, res, next) => {
  try {
    const { amountPaise } = req.body;
    const userId = req.params.id;

    const payout = await payoutService.requestPayout(userId, amountPaise);
    res.status(201).json({
      payoutId: payout._id,
      status: payout.status,
      amountINR: payout.amountPaise / 100
    });
  } catch (error) {
    next(error);
  }
};
