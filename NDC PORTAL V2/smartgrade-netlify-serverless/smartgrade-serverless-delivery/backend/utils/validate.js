function isNonEmptyString(v, max = 255) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Score must be a non-negative finite number not exceeding the configured maximum. */
function validateScore(rawScore, maxScore) {
  if (rawScore === null || rawScore === undefined) return { valid: true }; // "no score yet" is allowed
  if (!isFiniteNumber(rawScore)) return { valid: false, message: 'Score must be a number.' };
  if (rawScore < 0) return { valid: false, message: 'Score cannot be negative.' };

  // PostgreSQL NUMERIC values are commonly returned by node-postgres as strings.
  // Normalize the configured maximum before enforcing the upper bound so values
  // such as rawScore=55 and maxScore="50" cannot bypass validation.
  const maximum = Number(maxScore);
  if (maxScore !== null && maxScore !== undefined && maxScore !== '' && !Number.isFinite(maximum)) {
    return { valid: false, message: 'The configured maximum score is invalid.' };
  }
  if (Number.isFinite(maximum) && rawScore > maximum) {
    return { valid: false, message: `Score cannot exceed the maximum score (${maximum}).` };
  }
  return { valid: true };
}

module.exports = { isNonEmptyString, isEmail, isFiniteNumber, validateScore };
