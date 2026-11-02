export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
}

export function errorHandler(err, _req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status =
    Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status <= 599
      ? err.status
      : 500;

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    success: false,
    message:
      status >= 500
        ? "Internal server error"
        : err.message || "Request failed",
  });
}
