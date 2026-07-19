const mongoose = require('mongoose');
const User = require('../../src/models/user.model');
const Brand = require('../../src/models/brand.model');
const Sale = require('../../src/models/sale.model');
const Payout = require('../../src/models/payout.model');
const LedgerEntry = require('../../src/models/ledger.model');

const saleService = require('../../src/services/saleService');
const advancePayoutJobService = require('../../src/services/advancePayoutJobService');
const ledgerService = require('../../src/services/ledgerService');
const payoutService = require('../../src/services/payoutService');
const withdrawalService = require('../../src/services/withdrawalService');

describe('Payout System Money-Math Logic & Reconciliation', () => {
  let user;
  let brand;

  beforeEach(async () => {
    user = new User({ name: 'Kathan Shah', email: 'kathan@example.com' });
    await user.save();
    brand = new Brand({ name: 'BrandAcme' });
    await brand.save();
  });

  describe('1. Background Advance Job & Idempotency', () => {
    it('should pay exactly 10% advance on pending sales and be idempotent', async () => {
      // Create pending sale of ₹150 (15,000 paise)
      const sale = await saleService.recordSale(user._id, brand._id, 15000);
      expect(sale.status).toBe('pending');

      // Run advance job
      const run1 = await advancePayoutJobService.processPendingAdvances();
      expect(run1.processedCount).toBe(1);
      expect(run1.totalAdvancePaid).toBe(1500); // 10% of 15,000 = 1,500 paise

      // Verify derived balance is ₹15 (1,500 paise)
      const balance = await ledgerService.getWithdrawableBalance(user._id);
      expect(balance).toBe(1500);

      // Run job again (verify no duplicate is processed)
      const run2 = await advancePayoutJobService.processPendingAdvances();
      expect(run2.processedCount).toBe(0);
      expect(run2.totalAdvancePaid).toBe(0);

      // Verify balance remains ₹15
      const balanceAfter = await ledgerService.getWithdrawableBalance(user._id);
      expect(balanceAfter).toBe(1500);
    });
  });

  describe('2. Reconciliation Literal Case: ₹120-pending -> ₹68-final approved', () => {
    it('should calculate the remaining settlement correctly and resolve user balance to ₹68', async () => {
      // 1. Sale registered at ₹120 (12,000 paise)
      const sale = await saleService.recordSale(user._id, brand._id, 12000);
      expect(sale.earningPaise).toBe(12000);

      // 2. Advance job runs, pays ₹12 (1,200 paise)
      await advancePayoutJobService.processPendingAdvances();
      const balanceAfterAdvance = await ledgerService.getWithdrawableBalance(user._id);
      expect(balanceAfterAdvance).toBe(1200); // ₹12.00

      // 3. Admin reconciles sale to APPROVED at ₹68 (6,800 paise)
      const reconciledSale = await saleService.reconcileSale(sale._id, 'approved', 6800);
      expect(reconciledSale.status).toBe('approved');
      expect(reconciledSale.earningPaise).toBe(6800);

      // Verify remaining paid = final (6800) - advance (1200) = 5600 paise (₹56)
      const ledgerEntries = await LedgerEntry.find({ userId: user._id }).sort({ createdAt: 1 });
      expect(ledgerEntries.length).toBe(2);
      expect(ledgerEntries[0].type).toBe('ADVANCE');
      expect(ledgerEntries[0].amountPaise).toBe(1200);
      expect(ledgerEntries[1].type).toBe('FINAL_SETTLEMENT');
      expect(ledgerEntries[1].amountPaise).toBe(5600); // ₹56

      // Verify derived balance is exactly ₹68 (6,800 paise)
      const finalBalance = await ledgerService.getWithdrawableBalance(user._id);
      expect(finalBalance).toBe(6800); // ₹68.00
    });
  });

  describe('3. Admin Reconciliation: Rejected', () => {
    it('should write a negative adjustment for the advance when sale is REJECTED', async () => {
      const sale = await saleService.recordSale(user._id, brand._id, 10000); // ₹100
      await advancePayoutJobService.processPendingAdvances(); // pays ₹10

      const reconciledSale = await saleService.reconcileSale(sale._id, 'rejected');
      expect(reconciledSale.status).toBe('rejected');

      const balance = await ledgerService.getWithdrawableBalance(user._id);
      expect(balance).toBe(0); // ₹10 advance clawed back

      const ledger = await LedgerEntry.find({ userId: user._id }).sort({ createdAt: 1 });
      expect(ledger.length).toBe(2);
      expect(ledger[1].type).toBe('ADJUSTMENT');
      expect(ledger[1].amountPaise).toBe(-1000);
    });

    it('should allow withdrawable balance to go negative when sale is rejected after withdrawal', async () => {
      const sale = await saleService.recordSale(user._id, brand._id, 10000);
      await advancePayoutJobService.processPendingAdvances(); // balance = ₹10 (1000 paise)

      // Withdraw the ₹10
      await payoutService.requestPayout(user._id, 1000); // balance becomes 0

      // Reconcile rejected
      await saleService.reconcileSale(sale._id, 'rejected');

      const balance = await ledgerService.getWithdrawableBalance(user._id);
      expect(balance).toBe(-1000); // -1000 paise (₹-10)
    });
  });

  describe('4. Payout Withdrawal Limits & Rate Pacing', () => {
    it('should enforce 24h withdraw limit and block overdraft attempts', async () => {
      // 1. Give user some balance
      const sale = await saleService.recordSale(user._id, brand._id, 50000); // ₹500
      await advancePayoutJobService.processPendingAdvances();
      await saleService.reconcileSale(sale._id, 'approved'); // balance = 50,000 paise

      // 2. Withdrawal exceeds balance check
      await expect(payoutService.requestPayout(user._id, 60000))
        .rejects.toThrow('Insufficient balance for withdrawal');

      // 3. First withdrawal succeeds
      await payoutService.requestPayout(user._id, 10000); // withdraw ₹100

      // 4. Second withdrawal within 24h fails
      await expect(payoutService.requestPayout(user._id, 10000))
        .rejects.toThrow('Only one withdrawal is allowed every 24 hours');
    });

    it('should waive the 24h limit on failed payout webhooks to allow retry', async () => {
      const sale = await saleService.recordSale(user._id, brand._id, 50000);
      await advancePayoutJobService.processPendingAdvances();
      await saleService.reconcileSale(sale._id, 'approved');
      
      // Request withdrawal (initiated)
      const payout = await payoutService.requestPayout(user._id, 10000);

      // Requesting again fails (due to the withdrawal we just made)
      await expect(payoutService.requestPayout(user._id, 10000))
        .rejects.toThrow('Only one withdrawal is allowed every 24 hours');

      // Trigger processor failure
      await payoutService.failPayout(payout._id);

      // Verify balance is refunded
      const balance = await ledgerService.getWithdrawableBalance(user._id);
      expect(balance).toBe(50000);

      // Withdrawal again immediately succeeds because failed payout is excluded from rate limits
      const newPayout = await payoutService.requestPayout(user._id, 10000);
      expect(newPayout.status).toBe('initiated');
    });
  });

  describe('5. Transaction Rollback', () => {
    it('should abort transaction and rollback modifications on error', async () => {
      const sale = await saleService.recordSale(user._id, brand._id, 10000);
      await advancePayoutJobService.processPendingAdvances();

      const originalSave = LedgerEntry.prototype.save;
      jest.spyOn(LedgerEntry.prototype, 'save').mockImplementationOnce(function () {
        throw new Error('Forced rollback error');
      });

      await expect(saleService.reconcileSale(sale._id, 'approved'))
        .rejects.toThrow('Forced rollback error');

      LedgerEntry.prototype.save = originalSave;

      // Verify database rollback
      const checkSale = await Sale.findById(sale._id);
      expect(checkSale.status).toBe('pending'); // Rollback status

      const balance = await ledgerService.getWithdrawableBalance(user._id);
      expect(balance).toBe(1000); // Only advance remains
    });
  });
});
