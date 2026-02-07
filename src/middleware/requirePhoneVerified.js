const { sendError } = require('../utils/response');
const { HTTP_STATUS } = require('../types/enums');

const requirePhoneVerified = () => {
  return (req, res, next) => {
    const role = String(req.userRole || req.user?.role || '').toUpperCase();

    if (role === 'PHARMACY' || role === 'PARAPHARMACY') {
      const isVerified = Boolean(req.user?.isPhoneVerified);
      if (!isVerified) {
        return sendError(
          res,
          'Phone number is not verified',
          [{ message: 'Please verify your phone number before uploading documents.' }],
          HTTP_STATUS.FORBIDDEN
        );
      }
    }

    next();
  };
};

module.exports = requirePhoneVerified;
