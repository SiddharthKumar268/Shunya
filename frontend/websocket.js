const SOCKET_URL = 'http://localhost:5000';
let socket;

function initWebSocket() {
  socket = io(SOCKET_URL);

  socket.on('connect', () => {
    console.log('✅ Connected to server');
    updateNetworkStatus('🟢 Online');
    addLog('Connected to Himalayan Mesh Network', 'success');
    socket.emit('network:scan');
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    updateNetworkStatus('🔴 Offline');
    addLog('Disconnected from network', 'error');
  });

  socket.on('network:update', (data) => {
    if (window.updateNetwork) {
      window.updateNetwork(data.soldiers, data.connections);
    }
  });

  socket.on('network:status', (data) => {
    if (window.updateNetwork) {
      window.updateNetwork(data.soldiers, data.connections);
    }
    addLog(`Network scan complete: ${data.soldiers.length} soldiers, ${data.connections.length} connections`, 'success');
  });

  socket.on('message:routing', (data) => {
    addLog(`Message ${data.messageId} routing from ${data.from} to ${data.to}`, 'info');
  });

  socket.on('message:hop', (data) => {
    addLog(`Message hop ${data.hopNumber}/${data.totalHops} at node ${data.currentNode}`, 'info');
    
    if (window.animateMessageHop) {
      window.animateMessageHop(data.currentNode);
    }
  });

  socket.on('message:delivered', (data) => {
    addLog(`Message ${data.messageId} delivered to ${data.to}`, 'success');
  });

  socket.on('error', (data) => {
    console.error('Socket error:', data);
    addLog(`Error: ${data.message}`, 'error');
  });

  return socket;
}

function updateNetworkStatus(status) {
  const statusElement = document.getElementById('network-status');
  if (statusElement) {
    statusElement.textContent = status;
  }
}

function emitSoldierUpdate(soldierId, data) {
  if (socket && socket.connected) {
    socket.emit('soldier:update', { soldierId, ...data });
  }
}

function emitMessageSend(messageData) {
  if (socket && socket.connected) {
    socket.emit('message:send', messageData);
  }
}

function requestNetworkScan() {
  if (socket && socket.connected) {
    socket.emit('network:scan');
  }
}