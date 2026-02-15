/**
 * Simple async wrapper for Express route handlers.
 * Usage: module.exports = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
 */
module.exports = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
