const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const sendOTPEmail = async (email, otp, username) => {
  const mailOptions = {
    from: `"Himalayan Mesh Protocol" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔐 Your Login OTP - Himalayan Mesh Protocol',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0e27 0%, #162336 100%);
            padding: 20px;
            margin: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(10, 22, 40, 0.95);
            border: 2px solid #2d4263;
            border-radius: 20px;
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #1a2942 0%, #0a1628 100%);
            padding: 30px;
            text-align: center;
            border-bottom: 2px solid #00d4ff;
          }
          .header h1 {
            color: #00d4ff;
            margin: 0;
            font-size: 24px;
            text-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
          }
          .logo {
            width: 80px;
            height: 80px;
            margin: 0 auto 20px;
            background: linear-gradient(135deg, #00ff95 0%, #00aa66 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            box-shadow: 0 0 30px rgba(0, 255, 149, 0.4);
          }
          .content {
            padding: 40px;
            color: #a8b8d8;
          }
          .otp-box {
            background: linear-gradient(135deg, #1a2942 0%, #0a1628 100%);
            border: 2px solid #00ff95;
            border-radius: 15px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
            box-shadow: 0 0 40px rgba(0, 255, 149, 0.3);
          }
          .otp-code {
            font-size: 48px;
            font-weight: bold;
            color: #00ff95;
            letter-spacing: 10px;
            font-family: 'Courier New', monospace;
            text-shadow: 0 0 20px rgba(0, 255, 149, 0.6);
          }
          .warning {
            background: rgba(255, 170, 0, 0.1);
            border-left: 4px solid #ffaa00;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .footer {
            background: #0a1628;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #1a2942;
          }
          .security-badge {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-top: 20px;
          }
          .security-badge span {
            background: rgba(0, 0, 0, 0.3);
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 11px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🛡️</div>
            <h1>HIMALAYAN MESH PROTOCOL</h1>
            <p style="color: #a8b8d8; margin: 10px 0 0 0;">Secure Military Communication System</p>
          </div>
          
          <div class="content">
            <h2 style="color: #00ff95; margin-top: 0;">Hello, ${username}!</h2>
            <p>Your One-Time Password (OTP) for login authentication:</p>
            
            <div class="otp-box">
              <p style="color: #00d4ff; margin: 0 0 15px 0; font-size: 14px;">YOUR OTP CODE</p>
              <div class="otp-code">${otp}</div>
              <p style="color: #666; margin: 15px 0 0 0; font-size: 12px;">Valid for 10 minutes</p>
            </div>
            
            <div class="warning">
              <strong style="color: #ffaa00;">⚠️ Security Notice:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Never share this OTP with anyone</li>
                <li>This code expires in 10 minutes</li>
                <li>If you didn't request this, contact your administrator immediately</li>
              </ul>
            </div>
            
            <p style="margin-top: 30px; color: #666; font-size: 13px;">
              This is an automated message from the Himalayan Mesh Protocol authentication system.
            </p>
          </div>
          
          <div class="footer">
            <div class="security-badge">
              <span>🔐 AES-256</span>
              <span>🔑 RSA-2048</span>
              <span>🛡️ BCRYPT</span>
            </div>
            <p style="margin-top: 15px;">
              © 2026 Himalayan Mesh Protocol | Secure Border Communications
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Email send error:', error);
    throw new Error('Failed to send OTP email');
  }
};

module.exports = { sendOTPEmail };