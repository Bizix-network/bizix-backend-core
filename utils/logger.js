const path = require('path');

function customLogger(...args) {
  const timestamp = new Date().toISOString();
  const callerFile = path.basename(new Error().stack.split('\n')[2].trim().split(' ')[1]);
  console.log(`[${timestamp}] [${callerFile}]`, ...args);
}

module.exports = customLogger;