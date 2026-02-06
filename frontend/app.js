// ===== AUTHENTICATION CHECK =====
const isAuthenticated = localStorage.getItem('isAuthenticated');
const userData = localStorage.getItem('user');

if (!isAuthenticated || isAuthenticated !== 'true') {
  window.location.href = '/login.html';
}

// Parse user data
let currentUser = null;
try {
  currentUser = JSON.parse(userData);
  console.log('✅ Logged in as:', currentUser.username);
} catch (e) {
  console.error('Failed to parse user data');
  window.location.href = '/login.html';
}

// ✅ Display username in welcome message
if (currentUser && currentUser.username) {
  const userNameElement = document.getElementById('user-name');
  if (userNameElement) {
    userNameElement.textContent = currentUser.username;
  }
}

// ===== LOGOUT FUNCTION =====
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
    window.location.href = '/login.html';
  }
}
// Rest of your existing app.js code below...

let soldiers = [];
let messageLog = [];
let deliveryConfirmations = [];
let animationFrame = 0;

// ✅ NEW: Image sharing state
let selectedImageData = null;

// ✅ NEW: GPS tracking state
let gpsTracking = false;
let gpsInterval = null;
let selectedSoldierForGPS = null;

// ✅ Real Himalayan posts with coordinates
const realPosts = {
  'Siachen Base Camp': { latitude: 35.4215, longitude: 77.2588, altitude: 5753 },
  'Kumar Post': { latitude: 35.4385, longitude: 77.3142, altitude: 5900 },
  'Bana Post': { latitude: 35.4563, longitude: 77.2961, altitude: 6100 },
  'Sonam Post': { latitude: 35.4721, longitude: 77.3205, altitude: 6200 },
  'Amar Post': { latitude: 35.4892, longitude: 77.3384, altitude: 6300 },
  'Command Center Leh': { latitude: 34.1526, longitude: 77.5771, altitude: 3500 }
};

function addLog(message, type = 'info') {
  logActivity(message, type);
}

async function init() {
  console.log('🚀 Initializing Himalayan Mesh Protocol...');
  await loadSoldiers();
  updateSoldierDropdowns();
  setupEventListeners();
  setupImageUpload();
  updateStats();
  
  // Initialize real map
  initMap();
  drawNetwork(); // This will now update the map
  
  try {
    if (typeof initWebSocket === 'function') {
      initWebSocket();
      console.log('✅ WebSocket initialized');
    }
  } catch (error) {
    console.error('❌ WebSocket initialization failed:', error);
    updateNetworkStatus('🔴 Offline');
  }
  
  setInterval(updateStats, 5000);
  console.log('✅ Himalayan Mesh Protocol with real map ready');
}

async function loadSoldiers() {
  try {
    const data = await api.getAllSoldiers();
    soldiers = data.soldiers || [];
    updateSoldierList();
    updateSoldierDropdowns();
    drawNetwork();
    console.log(`✅ Loaded ${soldiers.length} soldiers`);
  } catch (error) {
    console.error('Error loading soldiers:', error);
    logActivity('Failed to load soldiers', 'error');
  }
}

function updateSoldierDropdowns() {
  const fromSelect = document.getElementById('msg-from');
  const toSelect = document.getElementById('msg-to');
  const receiveSelect = document.getElementById('receive-soldier');
  const historySelect = document.getElementById('history-soldier');
  const qrSelect = document.getElementById('qr-soldier');
  const sosSelect = document.getElementById('sos-from');
  const gpsSelect = document.getElementById('gps-soldier'); // ✅ NEW
  
  [fromSelect, toSelect, receiveSelect, historySelect, qrSelect, sosSelect, gpsSelect].forEach(select => {
    if (select) {
      while (select.options.length > 1) {
        select.remove(1);
      }
    }
  });
  
  soldiers.forEach(soldier => {
    [fromSelect, toSelect, receiveSelect, historySelect, qrSelect, sosSelect, gpsSelect].forEach(select => {
      if (select) {
        const option = document.createElement('option');
        option.value = soldier.soldierId;
        option.textContent = `${soldier.soldierId} - ${soldier.name}`;
        select.appendChild(option);
      }
    });
  });
}

function updateSoldierList() {
  const listDiv = document.getElementById('soldier-list');
  if (!listDiv) return;
  
  listDiv.innerHTML = '';
  
  if (soldiers.length === 0) {
    listDiv.innerHTML = '<p class="empty-state">No soldiers registered</p>';
    return;
  }
  
  soldiers.forEach(soldier => {
    const soldierCard = document.createElement('div');
    soldierCard.className = 'soldier-card';
    soldierCard.innerHTML = `
      <div class="soldier-header">
        <h4>${soldier.soldierId}</h4>
        <span class="status-indicator ${soldier.status}">${soldier.status}</span>
      </div>
      <p><strong>${soldier.name}</strong> - ${soldier.unit}</p>
      <p>📍 ${soldier.post}</p>
      <p>🔋 Battery: ${soldier.batteryLevel}%</p>
      <p>📶 Status: ${soldier.status}</p>
      <p>🔗 Connections: ${soldier.connections || 0}</p>
      <button onclick="deleteSoldier('${soldier.soldierId}')" class="delete-btn">Delete</button>
    `;
    listDiv.appendChild(soldierCard);
  });
}

function setupEventListeners() {
  const addForm = document.getElementById('add-soldier-form');
  const sendForm = document.getElementById('send-message-form');
  
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const soldierId = document.getElementById('soldier-id').value;
      const name = document.getElementById('soldier-name').value;
      const unit = document.getElementById('soldier-unit').value;
      const post = document.getElementById('soldier-post').value;
      
      const postCoordinates = realPosts[post];
      
      if (!postCoordinates) {
        alert('Invalid post selected');
        return;
      }
      
      try {
        const result = await api.registerSoldier({
          soldierId,
          name,
          unit,
          post,
          position: postCoordinates
        });
        
        logActivity(`✅ Soldier ${soldierId} registered successfully`, 'success');
        alert(`Soldier registered!\n\n⚠️ IMPORTANT: Save these keys securely!\n\nPublic Key: ${result.publicKey.substring(0, 50)}...\n\nPrivate Key: ${result.privateKey.substring(0, 50)}...`);
        
        e.target.reset();
        await loadSoldiers();
      } catch (error) {
        logActivity(`❌ Failed to register soldier: ${error.message}`, 'error');
        alert('Error: ' + error.message);
      }
    });
  }
  
  if (sendForm) {
    sendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const from = document.getElementById('msg-from').value;
      const to = document.getElementById('msg-to').value;
      const content = document.getElementById('msg-content').value;
      const priority = document.getElementById('msg-priority').value;
      const messageType = document.getElementById('msg-type').value;
      
      if (!from || !to) {
        alert('Please select both sender and receiver');
        return;
      }
      
      if (from === to) {
        alert('Sender and receiver cannot be the same');
        return;
      }
      
      try {
        showEncryptionDemo(content, from, to);
        
        // ✅ NEW: Include image data if selected
        const messageData = {
          from,
          to,
          content,
          priority,
          messageType
        };
        
        if (selectedImageData) {
          messageData.imageData = selectedImageData;
        }
        
        const result = await api.sendMessage(messageData);
        
        logActivity(`📨 Message sent from ${from} to ${to} (${result.hopCount} hops)${result.hasImage ? ' 📸' : ''}`, 'success');
        
        addDeliveryConfirmation({
          messageId: result.messageId,
          from: from,
          to: to,
          timestamp: new Date().toISOString(),
          status: 'delivered',
          hops: result.hopCount,
          encrypted: true,
          hasImage: result.hasImage
        });
        
        if (result.encryptedContent) {
          const demoEncrypted = document.getElementById('demo-encrypted');
          if (demoEncrypted) {
            demoEncrypted.innerHTML = `
              <p><strong>Encrypted Content:</strong></p>
              <code>${result.encryptedContent.substring(0, 100)}...</code>
              ${result.hasImage ? '<p><strong>📸 Image:</strong> Encrypted and attached</p>' : ''}
              <p><strong>Encrypted AES Key:</strong></p>
              <code>${result.encryptedAESKey ? result.encryptedAESKey.substring(0, 100) : 'N/A'}...</code>
              <p><strong>Digital Signature:</strong></p>
              <code>${result.signature ? result.signature.substring(0, 100) : 'N/A'}...</code>
            `;
          }
        }
        
        // Clear form and image
        e.target.reset();
        document.getElementById('msg-from').value = '';
        document.getElementById('msg-to').value = '';
        const preview = document.getElementById('image-preview');
        if (preview) preview.style.display = 'none';
        selectedImageData = null;
        
        alert(`✅ Message delivered!\n\nMessage ID: ${result.messageId}\nPath: ${result.path.join(' → ')}\nHops: ${result.hopCount}\n🔐 Encrypted: YES\n✅ Signed: YES${result.hasImage ? '\n📸 Image: Attached' : ''}`);
        
      } catch (error) {
        logActivity(`❌ Failed to send message: ${error.message}`, 'error');
        alert('Error: ' + error.message);
      }
    });
  }
}

// ========================================================================
// ✅ NEW FEATURE 1: IMAGE SHARING
// ========================================================================

function setupImageUpload() {
  const imageInput = document.getElementById('msg-image');
  const preview = document.getElementById('image-preview');
  const previewImg = document.getElementById('preview-img');
  const removeBtn = document.getElementById('remove-image');
  
  if (imageInput) {
    imageInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image too large! Maximum size is 5MB');
        imageInput.value = '';
        return;
      }
      
      try {
        // Show preview
        const reader = new FileReader();
        reader.onload = (event) => {
          previewImg.src = event.target.result;
          preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
        
        // Upload and compress image
        logActivity('📤 Uploading image...', 'info');
        const result = await api.uploadImage(file);
        selectedImageData = result.imageData;
        
        const compressionRatio = ((1 - result.size / result.originalSize) * 100).toFixed(1);
        logActivity(`✅ Image compressed by ${compressionRatio}% (${Math.round(result.size/1024)}KB)`, 'success');
        
      } catch (error) {
        console.error('Image upload error:', error);
        logActivity(`❌ Image upload failed: ${error.message}`, 'error');
        imageInput.value = '';
        preview.style.display = 'none';
        selectedImageData = null;
      }
    });
  }
  
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      imageInput.value = '';
      preview.style.display = 'none';
      previewImg.src = '';
      selectedImageData = null;
      logActivity('🗑️ Image removed', 'info');
    });
  }
}

// ========================================================================
// ✅ NEW FEATURE 2: GPS TRACKING & TRAILS
// ========================================================================

function startGPSSimulation() {
  const gpsSelect = document.getElementById('gps-soldier');
  if (!gpsSelect) return;
  
  selectedSoldierForGPS = gpsSelect.value;
  if (!selectedSoldierForGPS) {
    alert('Please select a soldier for GPS tracking');
    return;
  }
  
  gpsTracking = true;
  logActivity(`🗺️ GPS tracking started for ${selectedSoldierForGPS}`, 'success');
  
  // Simulate GPS updates every 5 seconds
  gpsInterval = setInterval(async () => {
    if (!gpsTracking) return;
    
    const soldier = soldiers.find(s => s.soldierId === selectedSoldierForGPS);
    if (!soldier) return;
    
    // Simulate small movement (0.001 degrees ≈ 111 meters)
    const newPosition = {
      latitude: soldier.position.latitude + (Math.random() - 0.5) * 0.001,
      longitude: soldier.position.longitude + (Math.random() - 0.5) * 0.001,
      altitude: soldier.position.altitude + Math.floor((Math.random() - 0.5) * 10)
    };
    
    try {
      await api.updateLocation(selectedSoldierForGPS, newPosition);
      await loadSoldiers(); // Refresh to show updated trail
      logActivity(`📍 GPS updated for ${selectedSoldierForGPS}`, 'info');
    } catch (error) {
      console.error('GPS update error:', error);
    }
    
  }, 5000);
}

function stopGPSSimulation() {
  gpsTracking = false;
  if (gpsInterval) {
    clearInterval(gpsInterval);
    gpsInterval = null;
  }
  logActivity(`🛑 GPS tracking stopped`, 'info');
}

// ========================================================================
// ✅ ENHANCED DRAW NETWORK WITH GPS TRAILS
// ========================================================================

function drawGPSTrails(ctx, positions) {
  soldiers.forEach(soldier => {
    if (!soldier.locationHistory || soldier.locationHistory.length < 2) return;
    
    const pos = positions[soldier.soldierId];
    if (!pos) return;
    
    // Draw trail with fading effect
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    ctx.beginPath();
    for (let i = 0; i < soldier.locationHistory.length - 1; i++) {
      const alpha = (i / soldier.locationHistory.length) * 0.6;
      ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
      
      // Simple representation - connect history points to current position
      const angle = (i / soldier.locationHistory.length) * Math.PI * 2;
      const offset = 30 + i * 2;
      const x = pos.x + Math.cos(angle) * offset;
      const y = pos.y + Math.sin(angle) * offset;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

async function receiveMessages() {
  const soldierId = document.getElementById('receive-soldier').value;
  
  if (!soldierId) {
    alert('Please select a soldier');
    return;
  }
  
  try {
    const result = await api.receiveMessages(soldierId);
    const messagesDiv = document.getElementById('received-messages');
    
    if (!messagesDiv) return;
    
    if (!result.messages || result.messages.length === 0) {
      messagesDiv.innerHTML = '<p class="empty-state">📭 No new messages</p>';
      logActivity(`📭 No messages for ${soldierId}`, 'info');
      return;
    }
    
    messagesDiv.innerHTML = '<h4 style="color: #00ff95; margin-bottom: 15px;">📬 Received Messages:</h4>';
    
    result.messages.forEach(msg => {
      const msgCard = document.createElement('div');
      msgCard.className = `message-card priority-${msg.priority}`;
      msgCard.innerHTML = `
        <div class="message-header">
          <strong>From: ${msg.from}</strong>
          <span class="timestamp">${new Date(msg.timestamp).toLocaleString()}</span>
        </div>
        <div class="message-content">
          <p><strong>📝 Message:</strong> ${msg.content}</p>
          ${msg.hasImage && msg.imageData ? `
            <div style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px;">
              <p style="color: #00ff95; margin-bottom: 8px;"><strong>📸 Attached Image:</strong></p>
              <img src="data:image/jpeg;base64,${msg.imageData}" style="max-width: 100%; border-radius: 8px; border: 2px solid rgba(0,255,149,0.3);">
            </div>
          ` : ''}
        </div>
        <div class="message-meta">
          <span>Priority: ${msg.priority}</span>
          <span>Type: ${msg.messageType}</span>
          <span>Hops: ${msg.hopCount}</span>
          ${msg.hasImage ? '<span style="color: #00ff95;">📸 Image</span>' : ''}
          <span class="signature-status ${msg.signatureValid ? 'valid' : 'invalid'}">
            ${msg.signatureValid ? '✅ Signature Valid' : '❌ Signature Invalid'}
          </span>
        </div>
        <div class="encryption-info">
          <small>🔐 Decrypted using RSA-2048 + AES-256-CBC | Signature verified with sender's public key</small>
        </div>
      `;
      messagesDiv.appendChild(msgCard);
      
      const demoDecrypted = document.getElementById('demo-decrypted');
      if (demoDecrypted) {
        demoDecrypted.innerHTML = `
          <p><strong>Receiver:</strong> ${soldierId}</p>
          <p><strong>Decrypted Message:</strong> ${msg.content}</p>
          <p><strong>Signature:</strong> ${msg.signatureValid ? '✅ Valid' : '❌ Invalid'}</p>
          <p class="success-text">Message successfully decrypted and verified!</p>
        `;
      }
    });
    
    logActivity(`📥 ${result.messages.length} messages received by ${soldierId}`, 'success');
    
  } catch (error) {
    console.error('Error receiving messages:', error);
    const messagesDiv = document.getElementById('received-messages');
    if (messagesDiv) {
      messagesDiv.innerHTML = `<p class="empty-state">❌ Error: ${error.message}</p>`;
    }
    logActivity(`❌ Failed to receive messages: ${error.message}`, 'error');
  }
}

async function showMessageHistory() {
  const soldierId = document.getElementById('history-soldier').value;
  
  if (!soldierId) {
    alert('Please select a soldier');
    return;
  }
  
  try {
    const result = await api.getMessageHistory(soldierId);
    const historyDiv = document.getElementById('message-history');
    
    if (!historyDiv) return;
    
    if (!result.messages || result.messages.length === 0) {
      historyDiv.innerHTML = '<p class="empty-state">No message history</p>';
      return;
    }
    
    historyDiv.innerHTML = `<h4 style="color: #00ff95; margin-bottom: 15px;">📜 Message History (${result.messages.length} messages):</h4>`;
    
    result.messages.forEach(msg => {
      const msgCard = document.createElement('div');
      msgCard.className = 'history-card';
      msgCard.innerHTML = `
        <div class="history-header">
          <span><strong>${msg.from}</strong> → <strong>${msg.to}</strong></span>
          <span class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>
        </div>
        <p><strong>Content:</strong> ${msg.content}</p>
        <div class="history-meta">
          <span>ID: ${msg.messageId}</span>
          <span>Priority: ${msg.priority}</span>
          <span>Hops: ${msg.hopCount}</span>
          <span>${msg.signatureValid ? '✅' : '❌'} Signature</span>
        </div>
      `;
      historyDiv.appendChild(msgCard);
    });
    
    logActivity(`📜 Loaded ${result.messages.length} messages from history`, 'info');
    
  } catch (error) {
    console.error('Error loading history:', error);
    const historyDiv = document.getElementById('message-history');
    if (historyDiv) {
      historyDiv.innerHTML = `<p class="empty-state">❌ Error: ${error.message}</p>`;
    }
    logActivity(`❌ Failed to load history: ${error.message}`, 'error');
  }
}

function showEncryptionDemo(originalMessage, from, to) {
  const demoOriginal = document.getElementById('demo-original');
  const demoEncrypted = document.getElementById('demo-encrypted');
  const demoDecrypted = document.getElementById('demo-decrypted');
  const demoKeys = document.getElementById('demo-keys');
  
  if (demoOriginal) {
    demoOriginal.innerHTML = `
      <p><strong>From:</strong> ${from}</p>
      <p><strong>To:</strong> ${to}</p>
      <p><strong>Message:</strong> ${originalMessage}</p>
      <p class="info-text">This message will be encrypted with AES-256 and RSA-2048</p>
    `;
  }
  
  if (demoEncrypted) {
    demoEncrypted.innerHTML = `
      <p class="info-text">⏳ Encrypting message...</p>
      <p>1. Generating random AES-256 key</p>
      <p>2. Encrypting message with AES key</p>
      <p>3. Encrypting AES key with receiver's RSA public key</p>
      <p>4. Signing message with sender's RSA private key</p>
    `;
  }
  
  if (demoDecrypted) {
    demoDecrypted.innerHTML = `<p class="info-text">Waiting for message delivery...</p>`;
  }
  
  if (demoKeys) {
    demoKeys.innerHTML = `
      <p><strong>Sender's Private Key:</strong> Used for signing</p>
      <p><strong>Receiver's Public Key:</strong> Used for encryption</p>
      <p><strong>Algorithm:</strong> RSA-2048 + AES-256-CBC</p>
    `;
  }
}

function addDeliveryConfirmation(confirmation) {
  deliveryConfirmations.unshift(confirmation);
  
  const deliveryLog = document.getElementById('delivery-log');
  if (!deliveryLog) return;
  
  const confirmCard = document.createElement('div');
  confirmCard.className = 'delivery-card';
  confirmCard.innerHTML = `
    <div class="delivery-header">
      <strong>📬 ${confirmation.messageId}</strong>
      <span class="status-badge success">✅ Delivered</span>
    </div>
    <p><strong>From:</strong> ${confirmation.from}</p>
    <p><strong>To:</strong> ${confirmation.to}</p>
    <p><strong>Hops:</strong> ${confirmation.hops}</p>
    <p><strong>Time:</strong> ${new Date(confirmation.timestamp).toLocaleTimeString()}</p>
    ${confirmation.hasImage ? '<p style="color: #00ff95;"><strong>📸 Image attached</strong></p>' : ''}
    <div class="encryption-badge">
      🔐 Encrypted & Signed
    </div>
  `;
  
  if (deliveryLog.firstChild) {
    deliveryLog.insertBefore(confirmCard, deliveryLog.firstChild);
  } else {
    deliveryLog.appendChild(confirmCard);
  }
  
  while (deliveryLog.children.length > 10) {
    deliveryLog.removeChild(deliveryLog.lastChild);
  }
}

async function deleteSoldier(soldierId) {
  if (!confirm(`Are you sure you want to delete soldier ${soldierId}?`)) {
    return;
  }
  
  try {
    await api.deleteSoldier(soldierId);
    logActivity(`🗑️ Soldier ${soldierId} deleted`, 'info');
    await loadSoldiers();
  } catch (error) {
    alert('Error: ' + error.message);
    logActivity(`❌ Failed to delete soldier: ${error.message}`, 'error');
  }
}

function generateQRCode() {
  const soldierId = document.getElementById('qr-soldier').value;
  
  if (!soldierId) {
    alert('Please select a soldier');
    return;
  }
  
  const soldier = soldiers.find(s => s.soldierId === soldierId);
  
  if (!soldier) {
    alert('Soldier not found');
    return;
  }
  
  const qrDisplay = document.getElementById('qr-code-display');
  const qrInfo = document.getElementById('qr-info');
  
  if (!qrDisplay || !qrInfo) return;
  
  qrDisplay.style.display = 'flex';
  qrDisplay.innerHTML = '';
  
  const qrData = JSON.stringify({
    id: soldier.soldierId,
    name: soldier.name,
    unit: soldier.unit,
    timestamp: Date.now()
  });
  
  console.log('✅ QR Data Length:', qrData.length, 'characters');
  
  new QRCode(qrDisplay, {
    text: qrData,
    width: 200,
    height: 200,
    colorDark: "#00ff95",
    colorLight: "#0a0e27",
    correctLevel: QRCode.CorrectLevel.M
  });
  
  qrInfo.innerHTML = `
    <div class="qr-info-box">
      <p><strong>🔐 Soldier Authentication QR Generated</strong></p>
      <p><strong>ID:</strong> ${soldier.soldierId}</p>
      <p><strong>Name:</strong> ${soldier.name}</p>
      <p><strong>Unit:</strong> ${soldier.unit}</p>
      <p class="qr-instruction">📱 Scan this QR code to authenticate soldier</p>
      
      <details style="margin-top: 10px;">
        <summary style="cursor: pointer; color: #00ff95;">🔑 View Public Key</summary>
        <div style="background: rgba(0,0,0,0.3); padding: 10px; margin-top: 5px; border-radius: 5px; max-height: 150px; overflow-y: auto;">
          <code style="font-size: 10px; word-break: break-all; color: #888;">
            ${soldier.publicKey}
          </code>
        </div>
      </details>
      
      <p class="qr-note"><small>⚠️ Public key securely stored on server</small></p>
    </div>
  `;
  
  logActivity(`🔐 QR Code generated for ${soldierId}`, 'success');
}

async function sendEmergencySOS() {
  const from = document.getElementById('sos-from').value;
  const message = document.getElementById('sos-message').value;
  
  if (!from) {
    alert('Please select your soldier ID');
    return;
  }
  
  if (!message.trim()) {
    alert('Please enter emergency details');
    return;
  }
  
  if (!confirm('⚠️ SEND EMERGENCY SOS TO ALL SOLDIERS?\n\nThis will broadcast to the entire network!')) {
    return;
  }
  
  const sosStatus = document.getElementById('sos-status');
  if (sosStatus) {
    sosStatus.innerHTML = '<p class="sos-sending">🚨 Broadcasting SOS...</p>';
  }
  
  try {
    // ✅ Send to all soldiers except sender, with individual error handling
    const promises = soldiers
      .filter(s => s.soldierId !== from)
      .map(soldier => 
        api.sendMessage({
          from: from,
          to: soldier.soldierId,
          content: `🚨 EMERGENCY SOS: ${message}`,
          priority: 'critical',
          messageType: 'medical-emergency'
        })
        .catch(err => ({ 
          error: err.message, 
          to: soldier.soldierId 
        }))
      );
    
    const results = await Promise.all(promises);
    
    // ✅ Separate successful and failed messages
    const successful = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);
    
    // ✅ Display results in UI
    if (sosStatus) {
      let statusHTML = '';
      
      if (successful.length > 0) {
        statusHTML = `
          <div class="sos-success">
            <p>✅ SOS BROADCAST SUCCESSFUL</p>
            <p>Sent to ${successful.length} soldiers</p>
            <p>All messages encrypted & signed</p>
        `;
        
        if (failed.length > 0) {
          statusHTML += `
            <p style="color: #ffaa00; margin-top: 10px;">
              ⚠️ Could not reach ${failed.length} soldier(s)
            </p>
            <p style="font-size: 11px; color: #888;">
              (Network partition or no route available)
            </p>
          `;
        }
        
        statusHTML += `</div>`;
      } else {
        // All messages failed
        statusHTML = `
          <div class="sos-error">
            <p>❌ SOS BROADCAST FAILED</p>
            <p>No soldiers could be reached</p>
            <p>Check network connectivity</p>
          </div>
        `;
      }
      
      sosStatus.innerHTML = statusHTML;
    }
    
    // ✅ Log activity
    if (successful.length > 0) {
      logActivity(
        `🚨 EMERGENCY SOS broadcast by ${from} - ✅ ${successful.length} delivered, ⚠️ ${failed.length} failed`, 
        'error'
      );
    } else {
      logActivity(
        `🚨 EMERGENCY SOS broadcast by ${from} - ❌ All deliveries failed`, 
        'error'
      );
    }
    
    // ✅ Debug logging with detailed error info
    if (failed.length > 0) {
      console.log('🚨 SOS Failed Deliveries:', failed);
      console.table(failed.map(f => ({ 
        Soldier: f.to, 
        Reason: f.error 
      })));
    }
    
    if (successful.length > 0) {
      console.log(`✅ SOS Successfully Delivered to ${successful.length} soldiers:`, 
        successful.map(s => s.to).join(', ')
      );
    }
    
    // ✅ Clear the message input
    const sosMessageInput = document.getElementById('sos-message');
    if (sosMessageInput) {
      sosMessageInput.value = '';
    }
    
    // ✅ Hide status after 7 seconds
    setTimeout(() => {
      if (sosStatus) {
        sosStatus.innerHTML = '';
      }
    }, 7000);
    
  } catch (error) {
    console.error('❌ SOS Broadcast Error:', error);
    if (sosStatus) {
      sosStatus.innerHTML = `
        <div class="sos-error">
          <p>❌ SOS Broadcast Failed</p>
          <p>${error.message}</p>
        </div>
      `;
    }
    logActivity(`❌ SOS broadcast failed: ${error.message}`, 'error');
  }
}

function calculateSignalStrength(soldier1, soldier2) {
  if (!soldier1.position || !soldier2.position) return 'none';
  
  const lat1 = soldier1.position.latitude;
  const lon1 = soldier1.position.longitude;
  const lat2 = soldier2.position.latitude;
  const lon2 = soldier2.position.longitude;
  
  const distance = Math.sqrt(
    Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2)
  );
  
  // ✅ CHANGED: Increased range for Himalayan terrain
  if (distance < 5.0) return 'strong';   // Was 0.2
  if (distance < 10.0) return 'medium';  // Was 0.4
  if (distance < 15.0) return 'weak';    // Was 0.6
  return 'none';
}

async function updateStats() {
  try {
    const stats = await api.getMessageStats();
    
    const statMessages = document.getElementById('stat-messages');
    const statDelivered = document.getElementById('stat-delivered');
    const statHops = document.getElementById('stat-hops');
    const statRate = document.getElementById('stat-rate');
    const soldierCount = document.getElementById('soldier-count');
    const messageCount = document.getElementById('message-count');
    
    if (statMessages) statMessages.textContent = stats.totalMessages || 0;
    if (statDelivered) statDelivered.textContent = stats.deliveredMessages || 0;
    if (statHops) statHops.textContent = stats.averageHops || 0;
    if (statRate) statRate.textContent = stats.deliveryRate || '0%';
    if (soldierCount) soldierCount.textContent = `Soldiers: ${soldiers.length}`;
    if (messageCount) messageCount.textContent = `Messages: ${stats.totalMessages || 0}`;
    
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

function logActivity(message, type = 'info') {
  const logDiv = document.getElementById('activity-log');
  if (!logDiv) return;
  
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry log-${type}`;
  
  const timestamp = new Date().toLocaleTimeString();
  logEntry.innerHTML = `<span class="log-time">${timestamp}</span> ${message}`;
  
  if (logDiv.firstChild) {
    logDiv.insertBefore(logEntry, logDiv.firstChild);
  } else {
    logDiv.appendChild(logEntry);
  }
  
  while (logDiv.children.length > 20) {
    logDiv.removeChild(logDiv.lastChild);
  }
}

// ========================================================================
// ✅✅✅ PROFESSIONAL ANIMATED MAP WITH LEAFLET.JS
// ========================================================================
// ========================================================================
// ✅✅✅ OPTION 10: REALISTIC TACTICAL COMMAND CENTER MAP
// ========================================================================

let map = null;
let markers = {};
let coverageCircles = {};
let polylines = [];
let movingPackets = [];
let militaryIcons = {};

function initMap() {
  if (map) return;
  
  // Create map with tactical view
  map = L.map('real-map', {
    center: [35.4215, 77.2588],
    zoom: 10,
    zoomControl: true,
    scrollWheelZoom: true,
    preferCanvas: true
  });
  
  // ✅ Satellite imagery base
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri',
    maxZoom: 18
  }).addTo(map);
  
  // ✅ Dark tactical overlay
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
    attribution: '© CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
    opacity: 0.7
  }).addTo(map);
  
  console.log('✅ Tactical command map initialized');
}

// ✅ Create military-style marker icons
function createMilitaryMarker(soldier) {
  let icon, color, bgColor, borderColor;
  
  // Determine colors and icon based on status
  if (soldier.status === 'offline') {
    icon = '✖';
    color = '#ff4444';
    bgColor = 'rgba(255, 68, 68, 0.9)';
    borderColor = '#ff0000';
  } else if (soldier.batteryLevel < 20) {
    icon = '⚠';
    color = '#ffaa00';
    bgColor = 'rgba(255, 170, 0, 0.9)';
    borderColor = '#ff8800';
  } else {
    icon = '●';
    color = '#00ff95';
    bgColor = 'rgba(0, 255, 149, 0.9)';
    borderColor = '#00aa66';
  }
  
  // Determine unit symbol
  let unitSymbol = '🎖️';
  if (soldier.unit === 'BSF') unitSymbol = '🛡️';
  else if (soldier.unit === 'ITBP') unitSymbol = '⛰️';
  else if (soldier.unit === 'Medical Team') unitSymbol = '🏥';
  else if (soldier.unit === 'Command Center') unitSymbol = '📡';
  
  const markerHTML = `
    <div style="position: relative; width: 70px; height: 90px;">
      <!-- Tactical marker pin -->
      <div style="
        position: absolute;
        width: 40px;
        height: 40px;
        background: ${bgColor};
        border: 3px solid ${borderColor};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        top: 0;
        left: 15px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6), 0 0 20px ${color}40;
      "></div>
      
      <!-- Inner icon circle -->
      <div style="
        position: absolute;
        width: 32px;
        height: 32px;
        background: #0a1628;
        border: 2px solid ${color};
        border-radius: 50%;
        top: 4px;
        left: 19px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        z-index: 10;
      ">${unitSymbol}</div>
      
      <!-- Pulse ring animation -->
      ${soldier.status === 'active' ? `
        <div style="
          position: absolute;
          width: 60px;
          height: 60px;
          border: 2px solid ${color};
          border-radius: 50%;
          top: -10px;
          left: 5px;
          animation: tacPulse 2s infinite ease-out;
          opacity: 0.6;
        "></div>
      ` : ''}
      
      <!-- ID Label with military styling -->
      <div style="
        position: absolute;
        top: 50px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, ${bgColor} 0%, rgba(10, 22, 40, 0.95) 100%);
        color: ${color};
        padding: 4px 10px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: bold;
        white-space: nowrap;
        border: 1px solid ${borderColor};
        font-family: 'Courier New', monospace;
        letter-spacing: 0.5px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
        text-shadow: 0 0 5px ${color}80;
      ">${soldier.soldierId}</div>
      
      <!-- Battery indicator -->
      <div style="
        position: absolute;
        top: 68px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        padding: 2px 6px;
        border-radius: 2px;
        font-size: 8px;
        color: ${soldier.batteryLevel > 50 ? '#00ff95' : soldier.batteryLevel > 20 ? '#ffaa00' : '#ff4444'};
        border: 1px solid ${soldier.batteryLevel > 50 ? '#00ff95' : soldier.batteryLevel > 20 ? '#ffaa00' : '#ff4444'};
        font-family: monospace;
      ">🔋${soldier.batteryLevel}%</div>
    </div>
  `;
  
  return L.divIcon({
    className: 'military-marker',
    html: markerHTML,
    iconSize: [70, 90],
    iconAnchor: [35, 45],
    popupAnchor: [0, -45]
  });
}

function updateMapMarkers() {
  if (!map) {
    initMap();
  }
  
  // Clear existing elements
  Object.values(markers).forEach(m => map.removeLayer(m));
  Object.values(coverageCircles).forEach(circles => {
    circles.forEach(c => map.removeLayer(c));
  });
  polylines.forEach(l => map.removeLayer(l));
  movingPackets.forEach(p => map.removeLayer(p));
  
  markers = {};
  coverageCircles = {};
  polylines = [];
  movingPackets = [];
  
  if (soldiers.length === 0) {
    console.log('No soldiers to display');
    return;
  }
  
  // ✅ Add tactical coverage circles (smaller, more realistic)
  soldiers.forEach(soldier => {
    const circles = [];
    
    // Primary coverage (30km)
    const primaryCircle = L.circle(
      [soldier.position.latitude, soldier.position.longitude],
      {
        radius: 30000,
        color: soldier.status === 'active' ? '#00ff95' : '#ff4444',
        fillColor: soldier.status === 'active' ? '#00ff95' : '#ff4444',
        fillOpacity: 0.03,
        weight: 1,
        opacity: 0.3,
        dashArray: '10, 5'
      }
    ).addTo(map);
    circles.push(primaryCircle);
    
    // Secondary coverage (15km)
    const secondaryCircle = L.circle(
      [soldier.position.latitude, soldier.position.longitude],
      {
        radius: 15000,
        color: soldier.status === 'active' ? '#00ff95' : '#ff4444',
        fillColor: soldier.status === 'active' ? '#00ff95' : '#ff4444',
        fillOpacity: 0.05,
        weight: 1.5,
        opacity: 0.4,
        dashArray: '5, 5'
      }
    ).addTo(map);
    circles.push(secondaryCircle);
    
    coverageCircles[soldier.soldierId] = circles;
  });
  
  // ✅ Draw tactical connection lines
  soldiers.forEach((s1, i) => {
    soldiers.forEach((s2, j) => {
      if (i < j) {
        const strength = calculateSignalStrength(s1, s2);
        
        if (strength !== 'none') {
          let color, weight, opacity, dashArray, glowColor;
          
          if (strength === 'strong') {
            color = '#00ff95';
            glowColor = 'rgba(0, 255, 149, 0.4)';
            weight = 3;
            opacity = 0.8;
            dashArray = '10, 5';
          } else if (strength === 'medium') {
            color = '#ffaa00';
            glowColor = 'rgba(255, 170, 0, 0.4)';
            weight = 2.5;
            opacity = 0.6;
            dashArray = '8, 8';
          } else {
            color = '#ff4444';
            glowColor = 'rgba(255, 68, 68, 0.4)';
            weight = 2;
            opacity = 0.4;
            dashArray = '5, 10';
          }
          
          // Main connection line
          const line = L.polyline([
            [s1.position.latitude, s1.position.longitude],
            [s2.position.latitude, s2.position.longitude]
          ], {
            color: color,
            weight: weight,
            opacity: opacity,
            dashArray: dashArray,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);
          
          polylines.push(line);
          
          // Add data packet animation
          createTacticalPacket(line, color);
        }
      }
    });
  });
  
  // ✅ Add military markers (on top)
  soldiers.forEach(soldier => {
    const icon = createMilitaryMarker(soldier);
    
    const marker = L.marker(
      [soldier.position.latitude, soldier.position.longitude],
      { 
        icon: icon,
        zIndexOffset: 1000
      }
    ).addTo(map);
    
    // ✅ Military-style popup
    marker.bindPopup(`
      <div style="
        font-family: 'Courier New', monospace;
        background: linear-gradient(135deg, #0a1628 0%, #0d1b2a 100%);
        padding: 0;
        border-radius: 4px;
        min-width: 280px;
        border: 2px solid #2d4263;
        box-shadow: 0 0 30px rgba(0, 212, 255, 0.3);
      ">
        <!-- Header -->
        <div style="
          background: linear-gradient(135deg, #1a2942 0%, #0a1628 100%);
          padding: 12px;
          border-bottom: 2px solid #00d4ff;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="
            font-size: 16px;
            color: #00d4ff;
            font-weight: bold;
            letter-spacing: 1px;
          ">⬢ ${soldier.soldierId}</div>
          <div style="
            background: ${soldier.status === 'active' ? '#00ff95' : '#ff4444'};
            color: #000;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: bold;
          ">${soldier.status === 'active' ? 'ONLINE' : 'OFFLINE'}</div>
        </div>
        
        <!-- Content -->
        <div style="padding: 15px;">
          <table style="width: 100%; color: #a8b8d8; font-size: 12px; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1a2942;">
              <td style="padding: 6px 0; color: #666;">OPERATIVE:</td>
              <td style="padding: 6px 0; color: #00ff95; text-align: right; font-weight: bold;">${soldier.name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1a2942;">
              <td style="padding: 6px 0; color: #666;">UNIT:</td>
              <td style="padding: 6px 0; color: #00d4ff; text-align: right;">${soldier.unit}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1a2942;">
              <td style="padding: 6px 0; color: #666;">LOCATION:</td>
              <td style="padding: 6px 0; color: #a8b8d8; text-align: right;">${soldier.post}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1a2942;">
              <td style="padding: 6px 0; color: #666;">COORDINATES:</td>
              <td style="padding: 6px 0; color: #888; text-align: right; font-size: 10px;">
                ${soldier.position.latitude.toFixed(4)}°N ${soldier.position.longitude.toFixed(4)}°E
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #1a2942;">
              <td style="padding: 6px 0; color: #666;">ELEVATION:</td>
              <td style="padding: 6px 0; color: #a8b8d8; text-align: right;">${soldier.position.altitude}m MSL</td>
            </tr>
            <tr style="border-bottom: 1px solid #1a2942;">
              <td style="padding: 6px 0; color: #666;">POWER:</td>
              <td style="padding: 6px 0; text-align: right;">
                <span style="
                  color: ${soldier.batteryLevel > 50 ? '#00ff95' : soldier.batteryLevel > 20 ? '#ffaa00' : '#ff4444'};
                  font-weight: bold;
                ">${soldier.batteryLevel}%</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666;">NETWORK:</td>
              <td style="padding: 6px 0; color: #00d4ff; text-align: right;">${soldier.connections || 0} links</td>
            </tr>
          </table>
        </div>
        
        <!-- Footer -->
        <div style="
          background: #0a1628;
          padding: 8px 15px;
          border-top: 1px solid #1a2942;
          font-size: 9px;
          color: #666;
          text-align: center;
          letter-spacing: 0.5px;
        ">
          🔐 ENCRYPTED | AES-256 + RSA-2048
        </div>
      </div>
    `, {
      maxWidth: 320,
      className: 'tactical-popup'
    });
    
    markers[soldier.soldierId] = marker;
  });
  
  // Auto-fit bounds
  // Auto-fit bounds ONLY on first load
if (soldiers.length > 0 && !map._initialBoundsSet) {
  const bounds = L.latLngBounds(
    soldiers.map(s => [s.position.latitude, s.position.longitude])
  );
  map.fitBounds(bounds, { padding: [100, 100], maxZoom: 11 });
  map._initialBoundsSet = true;
}
}

// ✅ Create tactical data packet
function createTacticalPacket(line, color) {
  const points = line.getLatLngs();
  let progress = Math.random();
  
  const packet = L.circleMarker(points[0], {
    radius: 5,
    fillColor: color,
    color: '#ffffff',
    weight: 2,
    opacity: 1,
    fillOpacity: 1,
    className: 'tactical-packet'
  }).addTo(map);
  
  movingPackets.push(packet);
  
  function animate() {
    progress += 0.01;
    
    if (progress >= 1) {
      progress = 0;
    }
    
    const lat = points[0].lat + (points[1].lat - points[0].lat) * progress;
    const lng = points[0].lng + (points[1].lng - points[0].lng) * progress;
    
    packet.setLatLng([lat, lng]);
    
    // Pulsing effect
    const pulse = 4 + Math.sin(progress * Math.PI * 6) * 1.5;
    packet.setRadius(pulse);
    
    if (map && packet._map) {
      requestAnimationFrame(animate);
    }
  }
  
  animate();
}

function drawNetwork() {
  updateMapMarkers();
  setTimeout(drawNetwork, 5000);
}

function updateNetworkStatus(status) {
  const statusElement = document.getElementById('network-status');
  if (statusElement) {
    statusElement.textContent = status;
  }
}

window.addEventListener('DOMContentLoaded', init);

console.log('✅ app.js v10.0 - Tactical Command Center Map Ready! 🎖️');


// ✅ Update drawNetwork to use the new map
function drawNetwork() {
  updateMapMarkers();
  
  // Keep updating every 3 seconds for live feel
  setTimeout(drawNetwork, 3000);
}

function updateNetworkStatus(status) {
  const statusElement = document.getElementById('network-status');
  if (statusElement) {
    statusElement.textContent = status;
  }
}

window.addEventListener('DOMContentLoaded', init);

console.log('✅ app.js v6.0 - Image Sharing & GPS Tracking ready! 📸🗺️');