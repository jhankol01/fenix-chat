/**
 * 404 Not Found handler.
 * Catches requests to undefined routes and forwards a 404 error.
 */
export default function notFound(req, res, _next) {
  res.status(404).json({
    success: false,
    message: `Not Found — ${req.method} ${req.originalUrl}`,
  });
}
