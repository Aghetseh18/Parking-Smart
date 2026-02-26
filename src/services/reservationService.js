const crypto = require('crypto');

const generateOneTimeCode = () => {
    // Simple 6-digit code for prototype, or complex string
    return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars hex
};

module.exports = { generateOneTimeCode };
