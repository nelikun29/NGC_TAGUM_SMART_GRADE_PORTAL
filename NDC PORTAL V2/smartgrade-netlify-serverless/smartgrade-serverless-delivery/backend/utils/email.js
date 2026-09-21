const tls = require('tls');

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 465;

function smtpSend({ user, password, to, subject, text, html }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: SMTP_HOST,
      port: SMTP_PORT,
      servername: SMTP_HOST,
      rejectUnauthorized: true
    });

    let buffer = '';
    let settled = false;
    const waiters = [];

    function finishError(err) {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch {}
      reject(err instanceof Error ? err : new Error(String(err)));
    }

    function finishOk(value) {
      if (settled) return;
      settled = true;
      try { socket.end(); } catch {}
      resolve(value);
    }

    function parseResponses() {
      while (true) {
        const match = buffer.match(/(?:^|\r\n)(\d{3})([ -])([^\r\n]*)\r\n/);
        if (!match) return;

        const code = Number(match[1]);
        const separator = match[2];

        if (separator === '-') {
          const terminal = new RegExp('(?:^|\\r\\n)' + code + ' ([^\\r\\n]*)\\r\\n');
          const terminalMatch = buffer.match(terminal);
          if (!terminalMatch) return;
          const endIndex = terminalMatch.index + terminalMatch[0].length;
          const response = buffer.slice(0, endIndex).trim();
          buffer = buffer.slice(endIndex);
          if (waiters.length) waiters.shift()({ code, response });
          continue;
        }

        const endIndex = match.index + match[0].length;
        const response = buffer.slice(0, endIndex).trim();
        buffer = buffer.slice(endIndex);
        if (waiters.length) waiters.shift()({ code, response });
      }
    }

    socket.setEncoding('utf8');
    socket.setTimeout(15000);
    socket.on('timeout', () => finishError(new Error('Gmail SMTP connection timed out.')));
    socket.on('error', finishError);
    socket.on('data', chunk => {
      buffer += chunk;
      parseResponses();
    });

    function nextResponse() {
      return new Promise(resolveResponse => waiters.push(resolveResponse));
    }

    async function command(line, expectedCodes) {
      socket.write(line + '\r\n');
      const { code, response } = await nextResponse();
      if (!expectedCodes.includes(code)) {
        throw new Error('Gmail SMTP error ' + code + ': ' + response);
      }
      return response;
    }

    socket.once('secureConnect', async () => {
      try {
        let response = await nextResponse();
        if (response.code !== 220) throw new Error('Gmail SMTP greeting failed: ' + response.response);

        await command('EHLO smartgradeportal', [250]);
        await command('AUTH LOGIN', [334]);
        await command(Buffer.from(user).toString('base64'), [334]);
        await command(Buffer.from(password).toString('base64'), [235]);
        await command('MAIL FROM:<' + user + '>', [250]);
        await command('RCPT TO:<' + to + '>', [250, 251]);
        await command('DATA', [354]);

        const boundary = 'smartgrade_' + Date.now().toString(36);
        const message = [
          'From: NDC Smart Grade <' + user + '>',
          'To: <' + to + '>',
          'Subject: ' + subject,
          'MIME-Version: 1.0',
          'Content-Type: multipart/alternative; boundary="' + boundary + '"',
          '',
          '--' + boundary,
          'Content-Type: text/plain; charset=UTF-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          text,
          '',
          '--' + boundary,
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          html,
          '',
          '--' + boundary + '--',
          ''
        ].join('\r\n').replace(/^\./gm, '..');

        socket.write(message + '\r\n.\r\n');
        response = await nextResponse();
        if (response.code !== 250) throw new Error('Gmail SMTP send failed: ' + response.response);

        socket.write('QUIT\r\n');
        finishOk({ provider: 'gmail', accepted: [to] });
      } catch (err) {
        finishError(err);
      }
    });
  });
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const user = String(process.env.EMAIL_USER || '').trim();
  const password = String(process.env.EMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (!user || !password) {
    throw new Error('Password reset email is not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD.');
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

  return smtpSend({ user, password, to, subject, text, html });
}

module.exports = { sendPasswordResetEmail };
