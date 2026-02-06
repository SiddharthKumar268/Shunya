const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  encryptedContent: {
    type: String,
    required: true
  },
  encryptedAESKey: {
    type: String,
    required: true
  },
  signature: {
    type: String,
    required: true
  },
  // ✅ NEW FEATURE: Image attachment support
  imageData: {
    type: String  // Base64 encrypted image
  },
  hasImage: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  messageType: {
    type: String,
    enum: ['patrol-update', 'enemy-alert', 'medical-emergency', 'supply-request', 'weather-alert', 'general'],
    default: 'general'
  },
  path: [{
    soldierId: String,
    timestamp: Date,
    batteryLevel: Number
  }],
  hopCount: {
    type: Number,
    default: 0
  },
  delivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: {
    type: Date
  },
  failedAttempts: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    default: () => Date.now() + 24*60*60*1000,
    expires: 0
  }
}, {
  timestamps: true
});

MessageSchema.index({ from: 1, to: 1, createdAt: -1 });
MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Message', MessageSchema);