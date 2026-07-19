const express = require('express');
const router = express.Router();

const userRoutes = require('./user.routes');
const brandRoutes = require('./brand.routes');
const saleRoutes = require('./sale.routes');
const advanceRoutes = require('./advance.routes');
const payoutRoutes = require('./payout.routes');

router.use('/users', userRoutes);
router.use('/brands', brandRoutes);
router.use('/sales', saleRoutes);
router.use('/jobs', advanceRoutes);
router.use('/payouts', payoutRoutes);

module.exports = router;
