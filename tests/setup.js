const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Import models to register schemas and ensure index creation
const User = require('../src/models/user.model');
const Brand = require('../src/models/brand.model');
const Sale = require('../src/models/sale.model');
const Payout = require('../src/models/payout.model');
const LedgerEntry = require('../src/models/ledger.model');

let mongoServer;

beforeAll(async () => {
  // Start MongoMemoryReplSet to support multi-document ACID transactions
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      storageEngine: 'wiredTiger',
      dbName: 'payout_test'
    }
  });
  const mongoUri = mongoServer.getUri();
  
  // Close any existing connection if open
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(mongoUri);

  // Build all indexes upfront to prevent transaction write conflicts on dynamic index creation
  await Promise.all([
    User.ensureIndexes(),
    Brand.ensureIndexes(),
    Sale.ensureIndexes(),
    Payout.ensureIndexes(),
    LedgerEntry.ensureIndexes()
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  // Clear database collections before each test run
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
