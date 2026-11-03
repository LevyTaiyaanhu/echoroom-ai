import { verifyToken, tokenFromRequest } from "../lib/auth.js";

export function authenticate(req, _res, next) {
  const token = tokenFromRequest(req);
  if (!token) {
    const error = new Error("Authentication required");
    error.status = 401;
    return next(error);
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    const err = new Error("Invalid or expired token");
    err.status = 401;
    return next(err);
  }

  req.user = {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
  };
  next();
}

export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      const error = new Error("Authentication required");
      error.status = 401;
      return next(error);
    }
    if (!allowedRoles.includes(req.user.role)) {
      const error = new Error("Insufficient role");
      error.status = 403;
      return next(error);
    }
    next();
  };
}

export function requireOwnership(paramName = "userId") {
  return (req, _res, next) => {
    if (!req.user) {
      const error = new Error("Authentication required");
      error.status = 401;
      return next(error);
    }
    const requestedId = req.params[paramName] || req.body.userId;
    if (req.user.role === "admin" || req.user.id === requestedId) {
      return next();
    }
    const error = new Error("You can only access your own resources");
    error.status = 403;
    next(error);
  };
}