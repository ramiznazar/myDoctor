// Use stream-chat for proper token generation
const { StreamChat } = require('stream-chat');
const config = require('../config/env');

// Validate Stream credentials
if (!config.STREAM_API_KEY || !config.STREAM_API_SECRET) {
  console.error('❌ Stream API credentials are missing!');
  console.error('Please set STREAM_API_KEY and STREAM_API_SECRET in your .env file');
  throw new Error('Stream API credentials are not configured');
}

console.log('✅ Stream API Key:', config.STREAM_API_KEY ? `${config.STREAM_API_KEY.substring(0, 4)}...` : 'MISSING');
console.log('✅ Stream API Secret:', config.STREAM_API_SECRET ? 'SET' : 'MISSING');

// Initialize Stream Chat client for token generation
let streamClient;
try {
  streamClient = StreamChat.getInstance(
    config.STREAM_API_KEY,
    config.STREAM_API_SECRET
  );
  console.log('✅ Stream client initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Stream client:', error);
  throw error;
}

/**
 * Generate user token for Stream Video
 * @param {string} userId - User ID
 * @param {string} userName - User name (optional, for metadata)
 * @returns {string} User token
 */
const generateUserToken = (userId, userName) => {
  try {
    console.log(`🔑 Generating Stream token for user: ${userId} (${userName || 'N/A'})`);
    
    // StreamChat.createToken generates proper tokens for Stream Video
    const token = streamClient.createToken(userId);
    
    console.log('✅ Stream token generated successfully');
    return token;
  } catch (error) {
    console.error('❌ Error generating Stream token:', error);
    throw new Error(`Failed to generate Stream token: ${error.message}`);
  }
};

/**
 * Create a Stream call
 * Note: We don't create calls on backend - frontend creates them
 * This function is kept for compatibility but returns null
 * @param {string} callId - Unique call ID (e.g., appointment ID)
 * @param {Object} metadata - Call metadata
 * @returns {Promise<null>} Always returns null - frontend creates calls
 */
const createCall = async (callId, metadata = {}) => {
  console.log(`📞 Call creation skipped for: ${callId}`);
  console.log('ℹ️  Frontend will create the call when joining');
  console.log('📞 Call metadata:', JSON.stringify(metadata, null, 2));
  // Frontend creates calls - we just return null
  return null;
};

/**
 * Get existing Stream call
 * Note: Not used - frontend handles calls
 * @param {string} callId - Call ID
 * @returns {null} Always returns null
 */
const getCall = (callId) => {
  console.log(`📞 getCall called for: ${callId} (not implemented - frontend handles)`);
  return null;
};

/**
 * End Stream call
 * Note: Not used - frontend handles call ending
 * @param {string} callId - Call ID
 * @returns {Promise<void>}
 */
const endCall = async (callId) => {
  console.log(`📞 endCall called for: ${callId} (not implemented - frontend handles)`);
  // Frontend handles call ending
};

module.exports = {
  generateUserToken,
  createCall,
  getCall,
  endCall,
};

