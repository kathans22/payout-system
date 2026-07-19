const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payout.controller');

router.post('/:id/fail', payoutController.failPayout);

module.exports = router;
