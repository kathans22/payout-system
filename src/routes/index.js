const express = require('express');
const router = express.Router();

const merchantRoutes = require('./merchant.routes');
const saleRoutes = require('./sale.routes');
const advanceRoutes = require('./advance.routes');
const payoutRoutes = require('./payout.routes');
const adjustmentRoutes = require('./adjustment.routes');

router.use('/merchants', merchantRoutes);
router.use('/sales', saleRoutes);
router.use('/advances', advanceRoutes);
router.use('/payouts', payoutRoutes);
router.use('/adjustments', adjustmentRoutes);

module.exports = router;
