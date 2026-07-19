const express = require('express');
const router = express.Router();
const advanceController = require('../controllers/advance.controller');

router.post('/advance-payout', advanceController.requestAdvance);

module.exports = router;
