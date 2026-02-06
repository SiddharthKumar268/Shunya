const mongoose = require('mongoose');

const SoldierSchema = new mongoose.Schema({
  soldierId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  unit: {
    type: String,
    enum: ['Indian Army', 'BSF', 'ITBP', 'Medical Team', 'Command Center'],
    required: true
  },
  post: {
    type: String,
    required: true
  },
  position: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    altitude: {
      type: Number,
      required: true
    }
  },
  publicKey: {
    type: String,
    required: true
  },
  privateKey: {
    type: String,
    required: true,
    select: false
  },
  batteryLevel: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['active', 'low-battery', 'offline', 'emergency'],
    default: 'active'
  },
  connectedTo: [{
    type: String
  }],
  lastSeen: {
    type: Date,
    default: Date.now
  },
  signalStrength: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  // ✅ NEW FEATURE: GPS Location History for trail visualization
  locationHistory: [{
    latitude: Number,
    longitude: Number,
    altitude: Number,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// ✅ Method to add location to history (keep last 50 points)
SoldierSchema.methods.addLocationToHistory = function() {
  this.locationHistory.push({
    latitude: this.position.latitude,
    longitude: this.position.longitude,
    altitude: this.position.altitude,
    timestamp: new Date()
  });
  
  if (this.locationHistory.length > 50) {
    this.locationHistory = this.locationHistory.slice(-50);
  }
};

SoldierSchema.methods.updateBatteryStatus = function() {
  if (this.batteryLevel < 10) {
    this.status = 'emergency';
  } else if (this.batteryLevel < 20) {
    this.status = 'low-battery';
  } else {
    this.status = 'active';
  }
};

module.exports = mongoose.model('Soldier', SoldierSchema);