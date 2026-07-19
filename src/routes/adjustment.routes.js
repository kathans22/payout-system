const express = require('express');
const router = express.Router();
const adjustmentController = require('../controllers/adjustment.controller');

router.post('/', adjustmentController.createAdjustment);

module.exports = router;
