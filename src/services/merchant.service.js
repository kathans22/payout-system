const Merchant = require('../models/merchant.model');
const LedgerEntry = require('../models/ledger.model');

class MerchantService {
  async createMerchant(data) {
    if (!data.name || !data.email) {
      throw new Error('Name and email are required');
    }
    const existing = await Merchant.findOne({ email: data.email });
    if (existing) {
      throw new Error('Merchant with this email already exists');
    }
    const merchant = new Merchant(data);
    return await merchant.save();
  }

  async getMerchantById(id) {
    const merchant = await Merchant.findById(id);
    if (!merchant) {
      throw new Error('Merchant not found');
    }
    return merchant;
  }

  async getLedgerEntries(merchantId) {
    // Verify merchant exists
    await this.getMerchantById(merchantId);
    return await LedgerEntry.find({ merchantId }).sort({ createdAt: -1 });
  }
}

module.exports = new MerchantService();
