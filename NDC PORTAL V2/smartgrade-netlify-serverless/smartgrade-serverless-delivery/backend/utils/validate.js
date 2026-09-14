function isNonEmptyString(v, max = 255) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Score must be a non-negative number not exceeding max_score. */
function validateScore(rawScore, maxScore) {
  if (rawScore === null || rawScore === undefined) return { valid: true }; // "no score yet" is allowed
  if (!isFiniteNumber(rawScore)) return { valid: false, message: 'Score must be a number.' };
  if (rawScore < 0) return { valid: false, message: 'Score cannot be negative.' };
  if (isFiniteNumber(maxScore) && rawScore > maxScore) {
    return { valid: false, message: `Score cannot exceed the maximum score (${maxScore}).` };
  }
  return { valid: true };
}

module.exports = { isNonEmptyString, isEmail, isFiniteNumber, validateScore };
