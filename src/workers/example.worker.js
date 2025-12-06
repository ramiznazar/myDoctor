const { Worker } = require('bullmq');
const config = require('../config/env');

/**
 * Example worker setup using BullMQ
 * This worker processes jobs from the example-queue
 */

// Process job function
const processJob = async (job) => {
  console.log(`Processing job ${job.id} with data:`, job.data);
  
  try {
    // Simulate some work
    const { message, delay = 1000 } = job.data;
    
    // Update job progress
    await job.updateProgress(25);
    
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, delay));
    
    await job.updateProgress(50);
    
    // Your business logic here
    console.log(`Processing: ${message}`);
    
    await job.updateProgress(75);
    
    // Simulate more work
    await new Promise(resolve => setTimeout(resolve, delay));
    
    await job.updateProgress(100);
    
    // Return result
    return {
      success: true,
      message: `Job ${job.id} completed successfully`,
      processedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error processing job ${job.id}:`, error);
    throw error; // Re-throw to mark job as failed
  }
};

// Create worker
const exampleWorker = new Worker(
  'example-queue',
  processJob,
  {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined
    },
    concurrency: 5, // Process 5 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000 // Per second
    }
  }
);

// Worker event handlers
exampleWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

exampleWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

exampleWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Closing worker...');
  await exampleWorker.close();
  process.exit(0);
});

module.exports = exampleWorker;

