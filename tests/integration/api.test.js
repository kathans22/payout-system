const request = require('supertest');
const app = require('../../src/app');
const Merchant = require('../../src/models/merchant.model');
const Sale = require('../../src/models/sale.model');
const Payout = require('../../src/models/payout.model');

describe('Payout System REST APIs', () => {
  let merchantId;

  beforeEach(async () => {
    // Create a fresh merchant before each test
    const res = await request(app)
      .post('/api/merchants')
      .send({ name: 'API Test Merchant', email: 'apitest@merchant.com' });
    merchantId = res.body.id;
  });

  it('POST /api/merchants should create a new merchant', async () => {
    const res = await request(app)
      .post('/api/merchants')
      .send({ name: 'Another Merchant', email: 'another@merchant.com' });

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('Another Merchant');
    expect(res.body.id).toBeDefined();
  });

  it('GET /api/merchants/:id should retrieve merchant details', async () => {
    const res = await request(app)
      .get(`/api/merchants/${merchantId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(merchantId);
    expect(res.body.name).toBe('API Test Merchant');
  });

  it('POST /api/sales should create a pending sale', async () => {
    const res = await request(app)
      .post('/api/sales')
      .send({ merchantId, amount: 50000 }); // $500

    expect(res.statusCode).toBe(201);
    expect(res.body.amount).toBe(50000);
    expect(res.body.status).toBe('PENDING');
  });

  it('POST /api/advances/process should trigger the background job and pay 10% advance', async () => {
    // 1. Post a pending sale
    const saleRes = await request(app)
      .post('/api/sales')
      .send({ merchantId, amount: 50000 });

    // 2. Trigger background advances
    const processRes = await request(app)
      .post('/api/advances/process');

    expect(processRes.statusCode).toBe(200);
    expect(processRes.body.processedCount).toBe(1);
    expect(processRes.body.totalAdvancePaid).toBe(5000); // 10% of 50000 = 5000 cents

    // Verify merchant available balance increased by $50 (5000 cents)
    const merchantRes = await request(app).get(`/api/merchants/${merchantId}`);
    expect(merchantRes.body.availableBalance).toBe(5000);
  });

  it('POST /api/sales/:id/reconcile should reconcile a sale (APPROVED)', async () => {
    // 1. Create sale & process advance
    const saleRes = await request(app)
      .post('/api/sales')
      .send({ merchantId, amount: 50000 });
    const saleId = saleRes.body.saleId;
    await request(app).post('/api/advances/process');

    // 2. Reconcile sale
    const reconRes = await request(app)
      .post(`/api/sales/${saleId}/reconcile`)
      .send({ status: 'APPROVED' });

    expect(reconRes.statusCode).toBe(200);
    expect(reconRes.body.status).toBe('APPROVED');
    expect(reconRes.body.remainingEarned).toBe(45000); // 90% of 50000 = 45000 cents

    // Merchant balance: $50 advance + $450 remaining = $500 (50000 cents)
    const merchantRes = await request(app).get(`/api/merchants/${merchantId}`);
    expect(merchantRes.body.availableBalance).toBe(50000);
  });

  it('POST /api/payouts/:id/fail should fail a payout and refund balance', async () => {
    // 1. Give merchant some balance
    const saleRes = await request(app)
      .post('/api/sales')
      .send({ merchantId, amount: 50000 });
    const saleId = saleRes.body.saleId;
    await request(app).post('/api/advances/process');
    await request(app).post(`/api/sales/${saleId}/reconcile`).send({ status: 'APPROVED' }); // balance = 50000 cents

    // 2. Request payout
    const payoutRes = await request(app)
      .post('/api/payouts')
      .send({ merchantId, amount: 20000 }); // withdraw 20000 cents ($200)

    expect(payoutRes.statusCode).toBe(201);
    const payoutId = payoutRes.body.payoutId;

    // Merchant balance: 50000 - 20000 = 30000 cents ($300)
    let merchantRes = await request(app).get(`/api/merchants/${merchantId}`);
    expect(merchantRes.body.availableBalance).toBe(30000);

    // 3. Mark payout failed
    const failRes = await request(app)
      .post(`/api/payouts/${payoutId}/fail`);

    expect(failRes.statusCode).toBe(200);
    expect(failRes.body.status).toBe('FAILED');
    expect(failRes.body.refundedAmount).toBe(20000);

    // Balance refunded to 50000 cents ($500)
    merchantRes = await request(app).get(`/api/merchants/${merchantId}`);
    expect(merchantRes.body.availableBalance).toBe(50000);
  });
});
