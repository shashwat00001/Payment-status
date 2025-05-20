const express = require('express');
const bodyParser = require('body-parser');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const dbFile = './data.json';
let data = {};

if (fs.existsSync(dbFile)) {
  data = JSON.parse(fs.readFileSync(dbFile));
}

const ADMIN_USERNAME = 'shashwat_598-shukl@';
const ADMIN_PASSWORD = 'shashwat_598-shukl@-Passcode';

// Middleware for admin authentication
function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || auth.indexOf('Basic ') === -1) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication required.');
  }

  const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  const [username, password] = credentials;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Access denied.');
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/generate', async (req, res) => {
  const { name, upi, amount, note } = req.body;
  const code = uuidv4().split('-')[0];
  const createdAt = new Date();
  const expiry = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  data[code] = {
    name,
    upi,
    amount,
    note,
    createdAt: createdAt.toISOString(),
    expiry: expiry.toISOString(),
  };

  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
  res.redirect(`/pay/${code}`);
});

app.get('/pay/:code', async (req, res) => {
  const code = req.params.code;
  const user = data[code];
  if (!user) return res.send('Invalid code');

  const now = new Date();
  if (new Date(user.expiry) < now) return res.send('This code has expired.');

  const upiLink = `upi://pay?pa=${user.upi}&pn=${encodeURIComponent(user.name)}&am=${user.amount}&cu=INR&tn=${encodeURIComponent(user.note)}`;
  const qr = await qrcode.toDataURL(upiLink);

  res.send(`
    <html>
      <head>
        <title>Pay ${user.name}</title>
      </head>
      <body style="text-align:center;font-family:sans-serif;">
        <h1>Scan to Pay</h1>
        <p>Pay to: <strong>${user.name}</strong></p>
        <p>UPI ID: <strong>${user.upi}</strong></p>
        <p>Amount: <strong>₹${user.amount}</strong></p>
        <p>Note: <strong>${user.note}</strong></p>
        <p>Expires at: <strong>${new Date(user.expiry).toLocaleString()}</strong></p>
        <img src="${qr}" alt="UPI QR" /><br><br>
        <a href="${qr}" download="upi-qr-${code}.png">Download QR Code</a>
        <p><i>Scan using GPay, PhonePe, Paytm, etc.</i></p>
      </body>
    </html>
  `);
});

app.get('/cp-control', adminAuth, (req, res) => {
  let html = '<h1>All Generated Tyohar Codes</h1><ul>';
  for (const [code, info] of Object.entries(data)) {
    html += `<li><a href="/pay/${code}" target="_blank">${code}</a> - ${info.name} - ₹${info.amount} - ${info.note} - Expires: ${new Date(info.expiry).toLocaleString()}</li>`;
  }
  html += '</ul>';
  res.send(`<html><body style="font-family:sans-serif;">${html}</body></html>`);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
