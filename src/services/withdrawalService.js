const LedgerEntry = require('../models/ledger.model');
const Payout = require('../models/payout.model');

class WithdrawalService {
  async getLastWithdrawalAt(userId) {
    // 1. Fetch withdrawals ordered by latest first
    const withdrawals = await LedgerEntry.find({
      userId,
      type: 'WITHDRAWAL'
    })
    .sort({ createdAt: -1 });

    // 2. Iterate and return the timestamp of the first withdrawal that has NOT failed/cancelled
    for (const withdrawal of withdrawals) {
      if (withdrawal.referenceId) {
        const payout = await Payout.findById(withdrawal.referenceId);
        if (payout && ['failed', 'cancelled'].includes(payout.status)) {
          // This payout failed or was cancelled, so its withdrawal rule is waived
          continue;
        }
      }
      return withdrawal.createdAt;
    }

    return null;
  }
}

module.exports = new WithdrawalService();
