const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Soldier = require('../models/Soldier');
const { 
  generateAESKey, 
  encryptMessage, 
  decryptMessage,
  encryptAESKey,
  decryptAESKey,
  createSignature,
  verifySignature
} = require('../utils/crypto');
const { findShortestPath, canReachDestination } = require('../utils/routing');
const { 
  generateMessageId, 
  sanitizeMessage, 
  validateMessagePriority,
  checkRateLimit,
  logSecurityEvent 
} = require('../utils/security');

let messageLog = [];

const authenticateRequest = (req, res, next) => {
  return next();
};

router.use(authenticateRequest);

router.post('/send', async (req, res) => {
  try {
    const { from, to, content, priority, messageType, imageData } = req.body;
    
    if (!from || !to || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const sender = await Soldier.findOne({ soldierId: from }).select('+privateKey');
    const receiver = await Soldier.findOne({ soldierId: to });
    
    if (!sender || !receiver) {
      return res.status(404).json({ error: 'Sender or receiver not found' });
    }
    
    if (!checkRateLimit(from, messageLog)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    if (priority && !validateMessagePriority(priority)) {
      return res.status(400).json({ error: 'Invalid priority level' });
    }
    
    const allSoldiers = await Soldier.find();
    const path = findShortestPath(sender, receiver, allSoldiers);
    const sanitizedContent = sanitizeMessage(content);
    const aesKey = generateAESKey();
    const encryptedContent = encryptMessage(sanitizedContent, aesKey);
    const encryptedAESKey = encryptAESKey(aesKey, receiver.publicKey);
    const signature = createSignature(sanitizedContent, sender.privateKey);
    const messageId = generateMessageId();
    
    // ✅ NEW: Encrypt image if present
    let encryptedImageData = null;
    let hasImage = false;
    
    if (imageData) {
      encryptedImageData = encryptMessage(imageData, aesKey);
      hasImage = true;
    }
    
    const message = new Message({
      messageId,
      from,
      to,
      encryptedContent,
      encryptedAESKey,
      signature,
      imageData: encryptedImageData, // ✅ NEW: Store encrypted image
      hasImage, // ✅ NEW: Flag for image presence
      priority: priority || 'medium',
      messageType: messageType || 'general',
      path: path.map(soldierId => ({
        soldierId,
        timestamp: new Date(),
        batteryLevel: allSoldiers.find(s => s.soldierId === soldierId)?.batteryLevel || 0
      })),
      hopCount: path.length - 1
    });
    
    await message.save();
    
    messageLog.push({ from, timestamp: Date.now() });
    
    logSecurityEvent({
      type: 'MESSAGE_SENT',
      message: `Message ${messageId} sent from ${from} to ${to} via ${path.length - 1} hops${hasImage ? ' (with image)' : ''}`
    });
    
    res.status(201).json({
      messageId,
      from,
      to,
      path,
      hopCount: path.length - 1,
      encrypted: true,
      signed: true,
      hasImage, // ✅ NEW: Inform sender about image
      encryptedContent: encryptedContent.substring(0, 100) + '...',
      encryptedAESKey: encryptedAESKey.substring(0, 100) + '...',
      signature: signature.substring(0, 100) + '...',
      expiresIn: '24 hours'
    });
    
  } catch (error) {
    console.error('❌ Send error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/receive/:soldierId', async (req, res) => {
  try {
    const { soldierId } = req.params;
    const soldier = await Soldier.findOne({ soldierId }).select('+privateKey');
    
    if (!soldier) {
      return res.status(404).json({ error: 'Soldier not found' });
    }
    
    const messages = await Message.find({ to: soldierId, delivered: false });
    const decryptedMessages = [];
    
    for (const msg of messages) {
      try {
        const aesKey = decryptAESKey(msg.encryptedAESKey, soldier.privateKey);
        const decryptedContent = decryptMessage(msg.encryptedContent, aesKey);
        const sender = await Soldier.findOne({ soldierId: msg.from });
        
        if (!sender) throw new Error('Sender not found');
        
        const isValid = verifySignature(decryptedContent, msg.signature, sender.publicKey);
        
        // ✅ NEW: Decrypt image if present
        let decryptedImage = null;
        if (msg.hasImage && msg.imageData) {
          try {
            decryptedImage = decryptMessage(msg.imageData, aesKey);
          } catch (err) {
            console.error('Image decryption failed:', err);
          }
        }
        
        if (isValid) {
          msg.delivered = true;
          msg.deliveredAt = new Date();
          await msg.save();
        }
        
        decryptedMessages.push({
          messageId: msg.messageId,
          from: msg.from,
          content: decryptedContent,
          imageData: decryptedImage, // ✅ NEW: Include decrypted image
          hasImage: msg.hasImage, // ✅ NEW: Image flag
          priority: msg.priority,
          messageType: msg.messageType,
          path: msg.path,
          hopCount: msg.hopCount,
          timestamp: msg.createdAt,
          signatureValid: isValid,
          expiresAt: msg.expiresAt
        });
      } catch (error) {
        console.error('❌ Decrypt error:', error);
      }
    }
    
    res.json({ soldierId, messages: decryptedMessages, totalMessages: decryptedMessages.length });
  } catch (error) {
    console.error('❌ Receive error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/history/:soldierId', async (req, res) => {
  try {
    const { soldierId } = req.params;
    const soldier = await Soldier.findOne({ soldierId }).select('+privateKey');
    
    if (!soldier) {
      return res.status(404).json({ error: 'Soldier not found' });
    }
    
    const messages = await Message.find({
      $or: [{ from: soldierId }, { to: soldierId }]
    }).sort({ createdAt: -1 }).limit(50);
    
    const decryptedHistory = messages.map(msg => {
      try {
        let content = '[Encrypted]';
        let signatureValid = false;
        let decryptedImage = null;
        
        if (msg.to === soldierId) {
          const aesKey = decryptAESKey(msg.encryptedAESKey, soldier.privateKey);
          content = decryptMessage(msg.encryptedContent, aesKey);
          
          // ✅ NEW: Decrypt image for history
          if (msg.hasImage && msg.imageData) {
            try {
              decryptedImage = decryptMessage(msg.imageData, aesKey);
            } catch (err) {
              console.error('History image decryption failed');
            }
          }
        }
        
        return {
          messageId: msg.messageId,
          from: msg.from,
          to: msg.to,
          content,
          imageData: decryptedImage, // ✅ NEW
          hasImage: msg.hasImage, // ✅ NEW
          priority: msg.priority,
          messageType: msg.messageType,
          hopCount: msg.hopCount,
          delivered: msg.delivered,
          timestamp: msg.createdAt,
          signatureValid,
          expiresAt: msg.expiresAt
        };
      } catch (error) {
        return {
          messageId: msg.messageId,
          from: msg.from,
          to: msg.to,
          content: '[Decryption Failed]',
          hasImage: false
        };
      }
    });
    
    res.json({ soldierId, messages: decryptedHistory, totalMessages: decryptedHistory.length });
  } catch (error) {
    console.error('❌ History error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const totalMessages = await Message.countDocuments();
    const deliveredMessages = await Message.countDocuments({ delivered: true });
    const criticalMessages = await Message.countDocuments({ priority: 'critical' });
    const messagesWithImages = await Message.countDocuments({ hasImage: true }); // ✅ NEW
    
    const avgHops = await Message.aggregate([
      { $group: { _id: null, avgHops: { $avg: '$hopCount' } } }
    ]);
    
    res.json({
      totalMessages,
      deliveredMessages,
      criticalMessages,
      messagesWithImages, // ✅ NEW
      averageHops: avgHops[0]?.avgHops?.toFixed(1) || '0',
      deliveryRate: totalMessages > 0 ? ((deliveredMessages / totalMessages * 100).toFixed(0) + '%') : '0%'
    });
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;