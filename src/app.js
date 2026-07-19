const express = require('express');
const routes = require('./routes');

const app = express();

app.use(express.json());

// Main api routes
app.use('/api', routes);

// Global Error Handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const code = err.code || (status === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');
  const message = err.message || 'Internal Server Error';

  // Set Retry-After header if specified
  if (status === 429 && err.retryAfter !== undefined) {
    res.setHeader('Retry-After', err.retryAfter);
  }

  res.status(status).json({
    error: {
      code,
      message
    }
  });
});

module.exports = app;
