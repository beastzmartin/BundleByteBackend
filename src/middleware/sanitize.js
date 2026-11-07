/**
 * NoSQL Injection Sanitizer
 * Recursively removes keys starting with '$' or containing '.' from req.body, req.query, and req.params.
 */
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const cleaned = {};
  for (const key of Object.keys(obj)) {
    // Prohibit keys starting with $ or containing a dot
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    cleaned[key] = sanitizeObject(obj[key]);
  }
  return cleaned;
};

export const sanitizeInput = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};
