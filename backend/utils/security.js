const crypto = require('crypto');

const validateSoldierId = (soldierId) => {
  const pattern = /^(ARMY|BSF|ITBP|MED|CMD)-[A-Z0-9]{3,10}$/;  // ✅ Changed: 3-10 chars instead of exactly 6
  return pattern.test(soldierId);
};

const validateCoordinates = (position) => {
  const { latitude, longitude, altitude } = position;
  
  // ✅ WIDENED: Accept all realistic Himalayan region coordinates
  if (latitude < 30 || latitude > 40) return false;    // Was 32-37
  if (longitude < 70 || longitude > 85) return false;  // Was 74-80
  if (altitude < 1000 || altitude > 25000) return false; // Was 8000-25000
  
  return true;
};

const generateMessageId = () => {
  return 'MSG-' + crypto.randomBytes(8).toString('hex').toUpperCase();
};

const sanitizeMessage = (message) => {
  return message
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, 1000);
};

const validateMessagePriority = (priority) => {
  const validPriorities = ['low', 'medium', 'high', 'critical'];
  return validPriorities.includes(priority);
};

const checkRateLimit = (soldierId, messageLog, timeWindow = 60000, maxMessages = 10) => {
  const now = Date.now();
  const recentMessages = messageLog.filter(
    msg => msg.from === soldierId && (now - msg.timestamp) < timeWindow
  );
  
  return recentMessages.length < maxMessages;
};

const detectSuspiciousActivity = (soldier, messageLog) => {
  const suspiciousPatterns = {
    rapidMessages: false,
    locationJump: false,
    batteryAnomaly: false
  };
  
  const recentMessages = messageLog.filter(
    msg => msg.from === soldier.soldierId && 
    (Date.now() - msg.timestamp) < 300000
  );
  
  if (recentMessages.length > 50) {
    suspiciousPatterns.rapidMessages = true;
  }
  
  if (soldier.batteryLevel > 95 && soldier.lastSeen && 
      (Date.now() - soldier.lastSeen) > 3600000) {
    suspiciousPatterns.batteryAnomaly = true;
  }
  
  return suspiciousPatterns;
};

const logSecurityEvent = (event) => {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY] ${timestamp} - ${event.type}: ${event.message}`);
  
  return {
    timestamp,
    ...event
  };
};

module.exports = {
  validateSoldierId,
  validateCoordinates,
  generateMessageId,
  sanitizeMessage,
  validateMessagePriority,
  checkRateLimit,
  detectSuspiciousActivity,
  logSecurityEvent
};