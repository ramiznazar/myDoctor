const { Queue } = require('bullmq');
const config = require('../config/env');

/**
 * Example queue setup using BullMQ
 * This is a template for creating job queues
 */
const exampleQueue = new Queue('example-queue', {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

/**
 * Add a job to the queue
 * @param {Object} jobData - Job data
 * @param {Object} options - Job options
 * @returns {Promise<Object>} Added job
 */
const addJob = async (jobData, options = {}) => {
  return await exampleQueue.add('example-job', jobData, options);
};

/**
 * Get queue status
 * @returns {Promise<Object>} Queue status
 */
const getQueueStatus = async () => {
  const [waiting, active, completed, failed] = await Promise.all([
    exampleQueue.getWaitingCount(),
    exampleQueue.getActiveCount(),
    exampleQueue.getCompletedCount(),
    exampleQueue.getFailedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed
  };
};

module.exports = {
  exampleQueue,
  addJob,
  getQueueStatus
};

