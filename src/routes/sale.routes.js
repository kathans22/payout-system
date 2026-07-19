const express = require('express');
const router = express.Router();
const saleController = require('../controllers/sale.controller');

router.post('/', saleController.recordSale);
router.post('/:id/reconcile', saleController.reconcileSale);

module.exports = router;
