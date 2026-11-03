// Use stream-chat for proper token generation
const { StreamChat } = require('stream-chat');
const config = require('../config/env');

// Video calls are optional infrastructure.  Do not make the whole API fail to
// boot when a local/development environment has not configured Stream; the
// video endpoint will return a clear error only when somebody starts a call.
let streamClient = null;
if (!config.STREAM_API_KEY || !config.STREAM_API_SECRET) {
  console.warn('⚠️ Stream API credentials are missing; video calls are unavailable until configured.');
} else {
  try {
    streamClient = StreamChat.getInstance(
      config.STREAM_API_KEY,
      config.STREAM_API_SECRET
    );
    console.log('✅ Stream client initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Stream client:', error);
  }
}

/**
 * Generate user token for Stream Video
 * @param {string} userId - User ID
 * @param {string} userName - User name (optional, for metadata)
 * @returns {string} User token
 */
const generateUserToken = (userId, userName) => {
  if (!streamClient) {
    const error = new Error('Video calling is not configured. Please contact support.');
    error.statusCode = 503;
    throw error;
  }

  try {
    const token = streamClient.createToken(userId);
    return token;
  } catch (error) {
    throw new Error(`Failed to generate Stream token: ${error.message}`);
  }
};

/** Public key is safe for the browser and required by the Stream SDK. */
const getPublicApiKey = () => config.STREAM_API_KEY || null;
const isConfigured = () => Boolean(streamClient && config.STREAM_API_KEY);

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
  getPublicApiKey,
  createCall,
  getCall,
  endCall,
  isConfigured,
};

