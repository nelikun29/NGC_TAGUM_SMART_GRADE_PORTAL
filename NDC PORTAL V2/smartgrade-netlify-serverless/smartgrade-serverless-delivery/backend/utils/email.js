const https = require('https');

function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const payload = JSON.stringify(body);
    const req = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers
      }
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch {}
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed || {});
          return;
        }
        const message = parsed?.message || parsed?.error || data || ('HTTP ' + res.statusCode);
        reject(new Error(message));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.PASSWORD_RESET_FROM_EMAIL || '').trim();

  if (!apiKey || !from) {
    throw new Error('Password reset email is not configured. Set RESEND_API_KEY and PASSWORD_RESET_FROM_EMAIL.');
  }

  const subject = 'Reset your NDC Smart Grade password';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033">
      <h2 style="color:#0b2457">Reset your password</h2>
      <p>A password reset was requested for your NDC Smart Grade &amp; Attendance Portal account.</p>
      <p style="margin:28px 0">
        <a href="${resetUrl}" style="background:#0b2457;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Reset Password</a>
      </p>
      <p>This link expires in 30 minutes and can only be used once.</p>
      <p>If you did not request this reset, you can ignore this email.</p>
    </div>`;
  const text = `Reset your NDC Smart Grade password using this link: ${resetUrl}\n\nThis link expires in 30 minutes and can only be used once.\nIf you did not request this reset, ignore this email.`;

  return postJson(
    'https://api.resend.com/emails',
    { Authorization: 'Bearer ' + apiKey },
    { from, to: [to], subject, html, text }
  );
}

module.exports = { sendPasswordResetEmail };
