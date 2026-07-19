const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Brand = require('../../src/models/brand.model');
const Sale = require('../../src/models/sale.model');
const Payout = require('../../src/models/payout.model');
const LedgerEntry = require('../../src/models/ledger.model');

describe('Payout System REST APIs', () => {
  let userId;
  let brandId;

  beforeEach(async () => {
    // Create a fresh user and brand before each test
    const userRes = await request(app)
      .post('/api/users')
      .send({ name: 'API Test User', email: 'apitest@user.com' });
    userId = userRes.body.id;

    const brandRes = await request(app)
      .post('/api/brands')
      .send({ name: 'BrandAcme' });
    brandId = brandRes.body.id;
  });

  it('POST /api/users should create a new user', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ name: 'Another User', email: 'another@user.com' });

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('Another User');
    expect(res.body.id).toBeDefined();
  });

  it('POST /api/brands should create a new brand', async () => {
    const res = await request(app)
      .post('/api/brands')
      .send({ name: 'BrandAcme2' });

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('BrandAcme2');
    expect(res.body.id).toBeDefined();
  });

  it('POST /api/sales should create a pending sale', async () => {
    const res = await request(app)
      .post('/api/sales')
      .send({ userId, brandId, earningPaise: 12000 });

    expect(res.statusCode).toBe(201);
    expect(res.body.earningINR).toBe(120.00);
    expect(res.body.status).toBe('pending');
  });

  it('POST /api/jobs/advance-payout should pay 10% advance', async () => {
    // 1. Post a pending sale
    await request(app)
      .post('/api/sales')
      .send({ userId, brandId, earningPaise: 12000 });

    // 2. Trigger advance job
    const processRes = await request(app)
      .post('/api/jobs/advance-payout');

    expect(processRes.statusCode).toBe(200);
    expect(processRes.body.processedCount).toBe(1);
    expect(processRes.body.totalAdvancePaidINR).toBe(12.00);

    // Verify balance
    const balRes = await request(app).get(`/api/users/${userId}/balance`);
    expect(balRes.body.balanceINR).toBe(12.00);
  });

  it('POST /api/sales/:id/reconcile should reconcile a sale approved at ₹68', async () => {
    // 1. Create sale & process advance
    const saleRes = await request(app)
      .post('/api/sales')
      .send({ userId, brandId, earningPaise: 12000 });
    const saleId = saleRes.body.saleId;
    await request(app).post('/api/jobs/advance-payout');

    // 2. Reconcile sale to ₹68 (6800 paise)
    const reconRes = await request(app)
      .post(`/api/sales/${saleId}/reconcile`)
      .send({ status: 'approved', finalEarningPaise: 6800 });

    expect(reconRes.statusCode).toBe(200);
    expect(reconRes.body.status).toBe('approved');
    expect(reconRes.body.remainingPaidINR).toBe(56.00); // 68 - 12 = 56

    // Verify balance
    const balRes = await request(app).get(`/api/users/${userId}/balance`);
    expect(balRes.body.balanceINR).toBe(68.00);
  });

  it('POST /api/payouts/:id/fail should fail a payout and refund balance', async () => {
    // 1. Give user some balance
    const saleRes = await request(app)
      .post('/api/sales')
      .send({ userId, brandId, earningPaise: 50000 });
    const saleId = saleRes.body.saleId;
    await request(app).post('/api/jobs/advance-payout');
    await request(app).post(`/api/sales/${saleId}/reconcile`).send({ status: 'approved' }); // balance = 500.00

    // 2. Request payout withdrawal
    const payoutRes = await request(app)
      .post(`/api/users/${userId}/withdraw`)
      .send({ amountPaise: 20000 }); // withdraw 20000 paise (₹200)

    expect(payoutRes.statusCode).toBe(201);
    const payoutId = payoutRes.body.payoutId;

    // Derived balance should be 300
    let balRes = await request(app).get(`/api/users/${userId}/balance`);
    expect(balRes.body.balanceINR).toBe(300.00);

    // 3. Mark payout failed
    const failRes = await request(app)
      .post(`/api/payouts/${payoutId}/fail`);

    expect(failRes.statusCode).toBe(200);
    expect(failRes.body.status).toBe('failed');
    expect(failRes.body.refundedINR).toBe(200.00);

    // Balance refunded to 500
    balRes = await request(app).get(`/api/users/${userId}/balance`);
    expect(balRes.body.balanceINR).toBe(500.00);
  });
});
