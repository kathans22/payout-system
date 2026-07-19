const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchant.controller');

router.post('/', merchantController.createMerchant);
router.get('/:id', merchantController.getMerchant);
router.get('/:id/ledger', merchantController.getLedger);

module.exports = router;
