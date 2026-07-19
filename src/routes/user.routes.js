const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

router.post('/', userController.createUser);
router.get('/:id', userController.getUser);
router.get('/:id/balance', userController.getBalance);
router.get('/:id/ledger', userController.getLedger);
router.post('/:id/withdraw', userController.withdraw);

module.exports = router;
