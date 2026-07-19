const express = require('express');
const routes = require('./routes');

const app = express();

app.use(express.json());

// Main api routes
app.use('/api', routes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

module.exports = app;
