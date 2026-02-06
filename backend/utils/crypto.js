const crypto = require('crypto');

const generateKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  return { publicKey, privateKey };
};

const generateAESKey = () => {
  return crypto.randomBytes(32);
};

const encryptMessage = (message, aesKey) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  
  let encrypted = cipher.update(message, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
};

const decryptMessage = (encryptedData, aesKey) => {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

const encryptAESKey = (aesKey, publicKey) => {
  return crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    aesKey
  ).toString('base64');
};

const decryptAESKey = (encryptedKey, privateKey) => {
  return crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(encryptedKey, 'base64')
  );
};

const createSignature = (message, privateKey) => {
  const sign = crypto.createSign('SHA256');
  sign.update(message);
  sign.end();
  
  return sign.sign(privateKey, 'hex');
};

const verifySignature = (message, signature, publicKey) => {
  const verify = crypto.createVerify('SHA256');
  verify.update(message);
  verify.end();
  
  return verify.verify(publicKey, signature, 'hex');
};

module.exports = {
  generateKeyPair,
  generateAESKey,
  encryptMessage,
  decryptMessage,
  encryptAESKey,
  decryptAESKey,
  createSignature,
  verifySignature
};