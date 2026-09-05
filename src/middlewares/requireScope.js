const AppError = require('../utils/AppError');

// Populated as a side effect of calling requireScope(...) — every route
// module registers its own scopes just by requiring this file and wiring
// requireScope('x') into its router, at require-time. This is the single
// source of truth: requiring src/routes (e.g. from the manage-client CLI)
// loads every route file and this set fills itself in, so a scope only
// ever needs to be written once, at the route.
const registeredScopes = new Set();

function getRegisteredScopes() {
  return [...registeredScopes].sort();
}

// Must run after requireAuth (needs req.scopes). There is no wildcard/"all
// access" scope — a client that needs every scope must be granted every
// scope explicitly, one by one.
function requireScope(...requiredScopes) {
  requiredScopes.forEach((scope) => registeredScopes.add(scope));

  return (req, res, next) => {
    const granted = req.scopes || [];
    const missing = requiredScopes.filter((scope) => !granted.includes(scope));

    if (missing.length > 0) {
      return next(
        new AppError(403, `Anda tidak memiliki akses untuk endpoint ini.`)
      );
    }

    next();
  };
}

module.exports = requireScope;
module.exports.getRegisteredScopes = getRegisteredScopes;
