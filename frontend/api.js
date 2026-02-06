// ✅ API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// ✅ Helper function to get headers (NO API KEY for dev)
const getHeaders = () => {
  return {
    'Content-Type': 'application/json'
    // No API key needed - authentication disabled in backend
  };
};

const api = {
  async registerSoldier(soldierData) {
    const response = await fetch(`${API_BASE_URL}/soldiers/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(soldierData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to register soldier');
    }
    
    return await response.json();
  },

  async getAllSoldiers() {
    const response = await fetch(`${API_BASE_URL}/soldiers/all`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch soldiers');
    }
    
    return await response.json();
  },

  async getSoldier(soldierId) {
    const response = await fetch(`${API_BASE_URL}/soldiers/${soldierId}`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch soldier');
    }
    
    return await response.json();
  },

  async updateBattery(soldierId, batteryLevel) {
    const response = await fetch(`${API_BASE_URL}/soldiers/${soldierId}/battery`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ batteryLevel })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update battery');
    }
    
    return await response.json();
  },

  async deleteSoldier(soldierId) {
    const response = await fetch(`${API_BASE_URL}/soldiers/${soldierId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete soldier');
    }
    
    return await response.json();
  },

  async sendMessage(messageData) {
    const response = await fetch(`${API_BASE_URL}/messages/send`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(messageData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }
    
    return await response.json();
  },

  async receiveMessages(soldierId) {
    const response = await fetch(`${API_BASE_URL}/messages/receive/${soldierId}`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to receive messages');
    }
    
    return await response.json();
  },
   async uploadImage(imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/api/upload-image`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) throw new Error('Failed to upload image');
    return await response.json();
  },

  async updateLocation(soldierId, position) {
    const response = await fetch(`${API_BASE_URL}/soldiers/${soldierId}/location`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(position)
    });
    if (!response.ok) throw new Error('Failed to update location');
    return await response.json();
  }
,

  async getMessageHistory(soldierId) {
    const response = await fetch(`${API_BASE_URL}/messages/history/${soldierId}`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch message history');
    }
    
    return await response.json();
  },

  async getMessageStats() {
    const response = await fetch(`${API_BASE_URL}/messages/stats`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch message stats');
    }
    
    return await response.json();
  }
};


console.log('✅ api.js loaded - NO DUPLICATES');