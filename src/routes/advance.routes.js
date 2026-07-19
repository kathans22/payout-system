const express = require('express');
const router = express.Router();
const advanceController = require('../controllers/advance.controller');

router.post('/process', advanceController.requestAdvance);

module.exports = router;
