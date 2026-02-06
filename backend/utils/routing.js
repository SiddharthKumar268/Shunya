const calculateDistance = (pos1, pos2) => {
  const R = 6371;
  const dLat = (pos2.latitude - pos1.latitude) * Math.PI / 180;
  const dLon = (pos2.longitude - pos1.longitude) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(pos1.latitude * Math.PI / 180) * Math.cos(pos2.latitude * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
};

const calculateAltitudeDifference = (pos1, pos2) => {
  return Math.abs(pos1.altitude - pos2.altitude);
};

const isInRange = (soldier1, soldier2, maxRange = 50) => {
  const distance = calculateDistance(soldier1.position, soldier2.position);
  const altitudeDiff = calculateAltitudeDifference(soldier1.position, soldier2.position);
  
  if (altitudeDiff > 2000) {
    maxRange = maxRange * 0.7;
  }
  
  if (soldier1.batteryLevel < 20 || soldier2.batteryLevel < 20) {
    maxRange = maxRange * 0.8;
  }
  
  return distance <= maxRange;
};

const findShortestPath = (fromSoldier, toSoldier, allSoldiers) => {
  const queue = [[fromSoldier.soldierId]];
  const visited = new Set([fromSoldier.soldierId]);
  
  while (queue.length > 0) {
    const path = queue.shift();
    const currentId = path[path.length - 1];
    
    if (currentId === toSoldier.soldierId) {
      return path;
    }
    
    const currentSoldier = allSoldiers.find(s => s.soldierId === currentId);
    
    if (!currentSoldier) continue;
    
    for (const soldier of allSoldiers) {
      if (visited.has(soldier.soldierId)) continue;
      
      if (isInRange(currentSoldier, soldier) && soldier.status !== 'offline') {
        visited.add(soldier.soldierId);
        queue.push([...path, soldier.soldierId]);
      }
    }
  }
  
  return null;
};

const updateConnections = (soldiers) => {
  const connections = [];
  
  for (let i = 0; i < soldiers.length; i++) {
    soldiers[i].connectedTo = [];
    
    for (let j = 0; j < soldiers.length; j++) {
      if (i !== j && isInRange(soldiers[i], soldiers[j])) {
        soldiers[i].connectedTo.push(soldiers[j].soldierId);
        connections.push({
          from: soldiers[i].soldierId,
          to: soldiers[j].soldierId,
          distance: calculateDistance(soldiers[i].position, soldiers[j].position)
        });
      }
    }
  }
  
  return connections;
};

const canReachDestination = (fromSoldier, toSoldier, allSoldiers) => {
  const path = findShortestPath(fromSoldier, toSoldier, allSoldiers);
  return path !== null;
};

module.exports = {
  calculateDistance,
  calculateAltitudeDifference,
  isInRange,
  findShortestPath,
  updateConnections,
  canReachDestination
};