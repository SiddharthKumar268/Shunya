const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { sendOTPEmail } = require('../config/email');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: existingUser.username === username ? 'Username already exists' : 'Email already registered' 
      });
    }
    
    // Create user
    const user = new User({
      username,
      email,
      password,
      role: role || 'operator'
    });
    
    await user.save();
    
    console.log(`✅ User registered: ${username}`);
    
    res.status(201).json({
      message: 'User registered successfully',
      username: user.username,
      email: user.email,
      role: user.role
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Step 1: Login - Verify credentials and send OTP
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Find user and include OTP fields
    const user = await User.findOne({ username }).select('+otpCode +otpExpires');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate OTP
    const otp = user.generateOTP();
    await user.save();
    
    // Send OTP email
    try {
      await sendOTPEmail(user.email, otp, user.username);
      
      console.log(`✅ OTP sent to ${user.username} (${user.email})`);
      
      res.json({
        message: 'OTP sent to your email',
        username: user.username,
        email: user.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Masked email
        requiresOTP: true
      });
      
    } catch (emailError) {
      console.error('Email error:', emailError);
      res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Step 2: Verify OTP and complete login
router.post('/verify-otp', async (req, res) => {
  try {
    const { username, otp } = req.body;
    
    if (!username || !otp) {
      return res.status(400).json({ error: 'Username and OTP required' });
    }
    
    // Find user with OTP fields
    const user = await User.findOne({ username }).select('+otpCode +otpExpires');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify OTP
    const isValid = user.verifyOTP(otp);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }
    
    // Clear OTP and update last login
    user.otpCode = undefined;
    user.otpExpires = undefined;
    user.isVerified = true;
    user.lastLogin = Date.now();
    await user.save();
    
    console.log(`✅ User logged in: ${username}`);
    
    res.json({
      message: 'Login successful',
      user: {
        username: user.username,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin
      },
      authenticated: true
    });
    
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    
    const user = await User.findOne({ username }).select('+otpCode +otpExpires');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate new OTP
    const otp = user.generateOTP();
    await user.save();
    
    // Send OTP email
    await sendOTPEmail(user.email, otp, user.username);
    
    console.log(`✅ OTP resent to ${user.username}`);
    
    res.json({
      message: 'OTP resent successfully',
      email: user.email.replace(/(.{2}).*(@.*)/, '$1***$2')
    });
    
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

module.exports = router;