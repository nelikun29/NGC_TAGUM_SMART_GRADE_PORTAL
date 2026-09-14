const crypto = require('crypto');
const { pool } = require('../db');

/**
 * Record an audit trail entry. Audit log is append-only: there is no
 * update/delete route exposed anywhere in the API, by design.
 * Fire-and-forget from the caller's perspective is NOT used — callers
 * `await audit(...)` so a failure surfaces rather than silently vanishing,
 * but a failed audit write never blocks the caller from continuing (see
 * the try/catch inside).
 */
async function audit(req, { action, recordType = null, recordId = null, previousValue = null, newValue = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (id, user_id, role, action, record_type, record_id, previous_value, new_value, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`,
      [
        crypto.randomUUID(),
        req.user ? req.user.id : null,
        req.user ? req.user.role : null,
        action,
        recordType,
        recordId,
        previousValue !== null ? JSON.stringify(previousValue) : null,
        newValue !== null ? JSON.stringify(newValue) : null,
        req.ip,
        req.headers['user-agent'] || null,
      ]
    );
  } catch (e) {
    console.error('Audit log write failed (continuing):', e.message);
  }
}

module.exports = { audit };
