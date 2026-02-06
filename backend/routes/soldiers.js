const express = require('express');
const router = express.Router();
const Soldier = require('../models/Soldier');
const { generateKeyPair } = require('../utils/crypto');
const { validateSoldierId, validateCoordinates, logSecurityEvent } = require('../utils/security');
const { updateConnections } = require('../utils/routing');

const authenticateRequest = (req, res, next) => {
  return next();
};

router.use(authenticateRequest);

router.post('/register', async (req, res) => {
  try {
    const { soldierId, name, unit, post, position } = req.body;
    
    if (!validateSoldierId(soldierId)) {
      return res.status(400).json({ error: 'Invalid soldier ID format' });
    }
    
    if (!validateCoordinates(position)) {
      return res.status(400).json({ error: 'Invalid coordinates for Himalayan region' });
    }
    
    const existingSoldier = await Soldier.findOne({ soldierId });
    if (existingSoldier) {
      return res.status(400).json({ error: 'Soldier already registered' });
    }
    
    const { publicKey, privateKey } = generateKeyPair();
    
    const soldier = new Soldier({
      soldierId,
      name,
      unit,
      post,
      position,
      publicKey,
      privateKey,
      batteryLevel: 100,
      status: 'active',
      locationHistory: [] // ✅ Initialize empty location history
    });
    
    await soldier.save();
    
    logSecurityEvent({
      type: 'SOLDIER_REGISTERED',
      message: `Soldier ${soldierId} registered at ${post}`
    });
    
    res.status(201).json({
      soldierId: soldier.soldierId,
      name: soldier.name,
      unit: soldier.unit,
      post: soldier.post,
      publicKey: soldier.publicKey,
      privateKey: soldier.privateKey,
      securityNote: 'Store privateKey securely - it will not be returned again'
    });
    
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/all', async (req, res) => {
  try {
    const soldiers = await Soldier.find().select('-privateKey');
    
    const allSoldiersWithKeys = await Soldier.find().select('+privateKey');
    const connections = updateConnections(allSoldiersWithKeys);
    
    res.json({
      soldiers,
      connections,
      totalSoldiers: soldiers.length,
      activeConnections: connections.length
    });
    
  } catch (error) {
    console.error('❌ Get all soldiers error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:soldierId', async (req, res) => {
  try {
    const soldier = await Soldier.findOne({ soldierId: req.params.soldierId }).select('-privateKey');
    
    if (!soldier) {
      return res.status(404).json({ error: 'Soldier not found' });
    }
    
    res.json({
      soldierId: soldier.soldierId,
      name: soldier.name,
      unit: soldier.unit,
      post: soldier.post,
      position: soldier.position,
      batteryLevel: soldier.batteryLevel,
      status: soldier.status,
      publicKey: soldier.publicKey,
      locationHistory: soldier.locationHistory || [] // ✅ Include location history
    });
    
  } catch (error) {
    console.error('❌ Get soldier error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:soldierId/battery', async (req, res) => {
  try {
    const { batteryLevel } = req.body;
    
    const soldier = await Soldier.findOne({ soldierId: req.params.soldierId });
    
    if (!soldier) {
      return res.status(404).json({ error: 'Soldier not found' });
    }
    
    soldier.batteryLevel = batteryLevel;
    
    if (typeof soldier.updateBatteryStatus === 'function') {
      soldier.updateBatteryStatus();
    }
    
    soldier.lastSeen = Date.now();
    await soldier.save();
    
    if (batteryLevel < 20) {
      logSecurityEvent({
        type: 'LOW_BATTERY_WARNING',
        message: `Soldier ${soldier.soldierId} battery critically low: ${batteryLevel}%`
      });
    }
    
    res.json({ 
      soldierId: soldier.soldierId,
      batteryLevel: soldier.batteryLevel, 
      status: soldier.status 
    });
    
  } catch (error) {
    console.error('❌ Update battery error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ NEW FEATURE: GPS Location Update Endpoint
router.put('/:soldierId/location', async (req, res) => {
  try {
    const { latitude, longitude, altitude } = req.body;
    
    const soldier = await Soldier.findOne({ soldierId: req.params.soldierId });
    
    if (!soldier) {
      return res.status(404).json({ error: 'Soldier not found' });
    }
    
    // Validate coordinates
    if (!validateCoordinates({ latitude, longitude, altitude })) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    
    // Update current position
    soldier.position = { latitude, longitude, altitude };
    
    // Add to location history trail
    if (typeof soldier.addLocationToHistory === 'function') {
      soldier.addLocationToHistory();
    }
    
    soldier.lastSeen = Date.now();
    await soldier.save();
    
    logSecurityEvent({
      type: 'LOCATION_UPDATED',
      message: `Soldier ${soldier.soldierId} location updated: ${latitude}, ${longitude}`
    });
    
    res.json({
      soldierId: soldier.soldierId,
      position: soldier.position,
      locationHistory: soldier.locationHistory,
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Update location error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:soldierId', async (req, res) => {
  try {
    const soldier = await Soldier.findOneAndDelete({ soldierId: req.params.soldierId });
    
    if (!soldier) {
      return res.status(404).json({ error: 'Soldier not found' });
    }
    
    logSecurityEvent({
      type: 'SOLDIER_REMOVED',
      message: `Soldier ${req.params.soldierId} removed from network`
    });
    
    res.json({ message: 'Soldier removed successfully' });
    
  } catch (error) {
    console.error('❌ Delete soldier error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;