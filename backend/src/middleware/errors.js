export function notFound(req, res) { res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` }); }
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || (err.name === 'ValidationError' || err.name === 'ZodError' ? 400 : err.code === 11000 ? 409 : 500);
  const message = status >= 500 ? 'An unexpected server error occurred.' : (err.message || 'Request failed.');
  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message, ...(process.env.NODE_ENV !== 'production' && err.issues ? { issues: err.issues } : {}) });
}
