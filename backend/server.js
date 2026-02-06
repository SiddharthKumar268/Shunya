const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

const connectDB = require('./config/db');
const soldierRoutes = require('./routes/soldiers');
const messageRoutes = require('./routes/messages');
const authRoutes = require('./routes/auth');
const Soldier = require('./models/Soldier');
const { updateConnections } = require('./utils/routing');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ✅ Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ✅ Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'himalayan-mesh-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ✅ Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// ✅ Image upload configuration
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ✅ Connect to MongoDB
connectDB();

// ✅ API Routes
app.use('/api/auth', authRoutes);
app.use('/api/soldiers', soldierRoutes);
app.use('/api/messages', messageRoutes);

// ✅ Image upload endpoint
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }
    
    const compressedImage = await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    
    const base64Image = compressedImage.toString('base64');
    
    res.json({ 
      imageData: base64Image,
      size: compressedImage.length,
      originalSize: req.file.size
    });
    
  } catch (error) {
    console.error('❌ Image upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Root route - serve login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// ✅ Dashboard route - serve main app
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ✅ Explicit login route
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// ✅ Explicit index route
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ✅ API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Himalayan Mesh Protocol API',
    version: '3.0.0',
    description: 'Secure mesh network for Indian Army/BSF communications',
    features: ['Authentication', '2FA OTP', 'Image Sharing', 'Real-Time GPS Tracking', 'End-to-End Encryption'],
    endpoints: {
      auth: '/api/auth',
      soldiers: '/api/soldiers',
      messages: '/api/messages',
      imageUpload: '/api/upload-image'
    }
  });
});

// ✅ WebSocket events
io.on('connection', (socket) => {
  console.log('🔗 New client connected:', socket.id);
  
  socket.on('soldier:update', async (data) => {
    try {
      const soldier = await Soldier.findOne({ soldierId: data.soldierId });
      
      if (soldier) {
        if (data.batteryLevel !== undefined) {
          soldier.batteryLevel = data.batteryLevel;
          soldier.updateBatteryStatus();
        }
        
        if (data.position) {
          soldier.position = data.position;
          if (typeof soldier.addLocationToHistory === 'function') {
            soldier.addLocationToHistory();
          }
        }
        
        soldier.lastSeen = Date.now();
        await soldier.save();
        
        const allSoldiers = await Soldier.find();
        const connections = updateConnections(allSoldiers);
        
        io.emit('network:update', {
          soldiers: allSoldiers,
          connections
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('message:send', async (data) => {
    try {
      io.emit('message:routing', {
        messageId: data.messageId,
        from: data.from,
        to: data.to,
        path: data.path
      });
      
      for (let i = 0; i < data.path.length; i++) {
        setTimeout(() => {
          io.emit('message:hop', {
            messageId: data.messageId,
            currentNode: data.path[i],
            hopNumber: i + 1,
            totalHops: data.path.length
          });
        }, i * 1000);
      }
      
      setTimeout(() => {
        io.emit('message:delivered', {
          messageId: data.messageId,
          to: data.to
        });
      }, data.path.length * 1000);
      
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('network:scan', async () => {
    try {
      const soldiers = await Soldier.find();
      const connections = updateConnections(soldiers);
      
      socket.emit('network:status', {
        soldiers,
        connections,
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// ✅ Battery drain simulation
setInterval(async () => {
  try {
    const soldiers = await Soldier.find();
    
    soldiers.forEach(async (soldier) => {
      if (soldier.status === 'active' && soldier.batteryLevel > 0) {
        soldier.batteryLevel = Math.max(0, soldier.batteryLevel - 0.5);
        soldier.updateBatteryStatus();
        await soldier.save();
      }
    });
    
    const connections = updateConnections(soldiers);
    
    io.emit('network:update', {
      soldiers,
      connections
    });
    
  } catch (error) {
    console.error('Battery drain update error:', error);
  }
}, 30000);

// ✅ Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   HIMALAYAN MESH PROTOCOL SERVER v3.0     ║');
  console.log('║   Indian Army/BSF Secure Network          ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Access at: http://localhost:${PORT}`);
  console.log(`🔐 Encryption: AES-256-CBC + RSA-2048`);
  console.log(`🔑 Authentication: Bcrypt + 2FA OTP`);
  console.log(`📧 Email: NodeMailer Enabled`);
  console.log(`📸 Image Sharing: Enabled`);
  console.log(`🗺️ GPS Tracking: Enabled`);
  console.log(`🌐 WebSocket: Active`);
  console.log(`📡 MongoDB: Connected`);
  console.log('═══════════════════════════════════════════');
});