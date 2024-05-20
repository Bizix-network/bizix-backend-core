const crypto = require('crypto');

function generateSecretKey(length) {
    return crypto.randomBytes(length).toString('hex');
}

console.log('JWT_SECRET=' + generateSecretKey(32)); // 32 bytes * 2 = 64 caractere hex
console.log('REFRESH_TOKEN_SECRET=' + generateSecretKey(32)); // 32 bytes * 2 = 64 caractere hex
