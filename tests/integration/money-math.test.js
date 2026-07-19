const mongoose = require('mongoose');
const Merchant = require('../../src/models/merchant.model');
const Sale = require('../../src/models/sale.model');
const Payout = require('../../src/models/payout.model');
const LedgerEntry = require('../../src/models/ledger.model');
const Adjustment = require('../../src/models/adjustment.model');

const merchantService = require('../../src/services/merchant.service');
const saleService = require('../../src/services/sale.service');
const advanceService = require('../../src/services/advance.service');
const payoutService = require('../../src/services/payout.service');

describe('Payout System Money-Math Logic & Reconciliation', () => {
  let merchant;

  beforeEach(async () => {
    merchant = await merchantService.createMerchant({
      name: 'Test Merchant',
      email: 'test@merchant.com'
    });
  });

  describe('1. Background Advance Job & Idempotency', () => {
    it('should pay 10% advance on pending sales exactly once (idempotent)', async () => {
      // 1. Create sale
      const sale = await saleService.recordSale(merchant._id, 10000); // $100.00
      expect(sale.status).toBe('PENDING');
      expect(sale.advanceProcessed).toBe(false);

      // 2. Run background job
      const run1 = await advanceService.processPendingAdvances();
      expect(run1.processedCount).toBe(1);
      expect(run1.totalAdvancePaid).toBe(1000); // 10% of $100 = $10 (1000 cents)

      // Verify Sale state
      const saleAfterRun = await Sale.findById(sale._id);
      expect(saleAfterRun.advancePaid).toBe(1000);
      expect(saleAfterRun.advanceProcessed).toBe(true);
      expect(saleAfterRun.advancePaidAt).toBeDefined();

      // Verify Merchant state
      const merchantAfterRun = await Merchant.findById(merchant._id);
      expect(merchantAfterRun.availableBalance).toBe(1000);

      // Verify Ledger
      const ledger = await LedgerEntry.find({ merchantId: merchant._id });
      expect(ledger.length).toBe(1);
      expect(ledger[0].category).toBe('ADVANCE_PAYOUT');
      expect(ledger[0].amount).toBe(1000);

      // 3. Run background job again (idempotence verification)
      const run2 = await advanceService.processPendingAdvances();
      expect(run2.processedCount).toBe(0);
      expect(run2.totalAdvancePaid).toBe(0);

      const merchantAfterRun2 = await Merchant.findById(merchant._id);
      expect(merchantAfterRun2.availableBalance).toBe(1000); // Unchanged
    });
  });

  describe('2. Admin Reconciliation (Approved vs Rejected)', () => {
    it('should award remaining 90% of earnings when sale is APPROVED', async () => {
      const sale = await saleService.recordSale(merchant._id, 10000); // $100
      await advanceService.processPendingAdvances(); // pays $10

      const reconciledSale = await saleService.reconcileSale(sale._id, 'APPROVED');
      expect(reconciledSale.status).toBe('APPROVED');

      const updatedMerchant = await Merchant.findById(merchant._id);
      expect(updatedMerchant.availableBalance).toBe(10000); // Total $100 earned ($10 advance + $90 remaining)

      const ledger = await LedgerEntry.find({ merchantId: merchant._id }).sort({ createdAt: 1 });
      // 1. Advance Payout (+1000)
      // 2. Reconciliation (+9000)
      expect(ledger.length).toBe(2);
      expect(ledger[1].category).toBe('RECONCILIATION');
      expect(ledger[1].amount).toBe(9000);
    });

    it('should write a negative adjustment for the advance when sale is REJECTED', async () => {
      const sale = await saleService.recordSale(merchant._id, 10000);
      await advanceService.processPendingAdvances(); // pays $10

      // Reconcile as rejected
      const reconciledSale = await saleService.reconcileSale(sale._id, 'REJECTED');
      expect(reconciledSale.status).toBe('REJECTED');

      const updatedMerchant = await Merchant.findById(merchant._id);
      expect(updatedMerchant.availableBalance).toBe(0); // $10 advance clawed back via negative adjustment

      const ledger = await LedgerEntry.find({ merchantId: merchant._id }).sort({ createdAt: 1 });
      // 1. Advance Payout (+1000)
      // 2. Adjustment Rejection (-1000)
      expect(ledger.length).toBe(2);
      expect(ledger[1].category).toBe('ADJUSTMENT');
      expect(ledger[1].amount).toBe(-1000);

      const adjustment = await Adjustment.findOne({ referenceId: sale._id });
      expect(adjustment.amount).toBe(-1000);
    });

    it('should drive merchant available balance negative when rejected sale is clawed back after withdrawal', async () => {
      const sale = await saleService.recordSale(merchant._id, 10000);
      await advanceService.processPendingAdvances(); // balance = $10

      // Withdraw the $10 advance payout
      await payoutService.requestPayout(merchant._id, 1000); // balance becomes 0

      // Reconcile rejected
      await saleService.reconcileSale(sale._id, 'REJECTED');

      const updatedMerchant = await Merchant.findById(merchant._id);
      expect(updatedMerchant.availableBalance).toBe(-1000); // -$10.00 (withdrawable balance is negative)
    });
  });

  describe('3. Payout withdrawal limitations (24h limit & recovery)', () => {
    it('should restrict withdrawal to once per 24 hours', async () => {
      // 1. Set balance to $500
      await saleService.recordSale(merchant._id, 50000);
      await advanceService.processPendingAdvances(); // pays $50
      await saleService.reconcileSale((await Sale.findOne({ merchantId: merchant._id }))._id, 'APPROVED'); // pays $450

      const checkMerchant = await Merchant.findById(merchant._id);
      expect(checkMerchant.availableBalance).toBe(50000);

      // 2. Request first withdrawal
      await payoutService.requestPayout(merchant._id, 10000); // withdraw $100

      // 3. Requesting again immediately should fail
      await expect(payoutService.requestPayout(merchant._id, 10000))
        .rejects.toThrow('Only one withdrawal is allowed every 24 hours');
    });

    it('should restore balance and lastWithdrawalAt timestamp on processor failure to allow retries', async () => {
      // Set balance to $500 and simulate a withdrawal that occurred 48 hours ago
      await saleService.recordSale(merchant._id, 50000);
      await advanceService.processPendingAdvances();
      await saleService.reconcileSale((await Sale.findOne({ merchantId: merchant._id }))._id, 'APPROVED');

      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await Merchant.findByIdAndUpdate(merchant._id, { lastWithdrawalAt: twoDaysAgo });

      // 1. Initiate payout (PENDING)
      const payout = await payoutService.requestPayout(merchant._id, 20000); // withdraw $200

      const merchantDuringPending = await Merchant.findById(merchant._id);
      expect(merchantDuringPending.availableBalance).toBe(30000); // reduced by $200
      expect(merchantDuringPending.lastWithdrawalAt.getTime()).toBeGreaterThan(twoDaysAgo.getTime()); // updated to now

      // 2. Fail payout
      await payoutService.failPayout(payout._id);

      const restoredMerchant = await Merchant.findById(merchant._id);
      expect(restoredMerchant.availableBalance).toBe(50000); // refunded
      expect(new Date(restoredMerchant.lastWithdrawalAt).getTime()).toBe(twoDaysAgo.getTime()); // restored to 48 hours ago

      // 3. Retrying withdrawal immediately succeeds (since 48h eligibility was restored)
      const newPayout = await payoutService.requestPayout(merchant._id, 20000);
      expect(newPayout.status).toBe('PENDING');
    });
  });

  describe('4. Transaction Rollback', () => {
    it('should roll back availableBalance and ledger entries on failed reconciliation', async () => {
      const sale = await saleService.recordSale(merchant._id, 10000);
      await advanceService.processPendingAdvances();

      // Force failure during save by mocking LedgerEntry.save to throw an error
      const originalSave = LedgerEntry.prototype.save;
      jest.spyOn(LedgerEntry.prototype, 'save').mockImplementationOnce(function () {
        throw new Error('Forced transaction failure');
      });

      await expect(saleService.reconcileSale(sale._id, 'APPROVED'))
        .rejects.toThrow('Forced transaction failure');

      LedgerEntry.prototype.save = originalSave;

      // Verify that merchant availableBalance is still 1000 (advance only) and status is PENDING
      const checkMerchant = await Merchant.findById(merchant._id);
      expect(checkMerchant.availableBalance).toBe(1000);

      const checkSale = await Sale.findById(sale._id);
      expect(checkSale.status).toBe('PENDING');

      // Verify no extra ledger entries were committed
      const ledger = await LedgerEntry.find({ merchantId: merchant._id });
      expect(ledger.length).toBe(1); // Only advance fee
    });
  });
});
