import { createApp } from './app.js';
import { config } from './utils/config.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`🚀 Backend API Server listening on port ${config.PORT} in ${config.NODE_ENV} mode`);
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated.');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated.');
  });
});
