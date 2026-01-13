/**
 * Access Control Middleware
 * Checks if user has permission to access features based on their groups
 */

let groupService = null;

const initialize = (service) => {
  groupService = service;
};

/**
 * Creates middleware that checks if user has permission for a specific feature
 * @param {string} feature - The feature to check permission for
 * @returns {Function} Express middleware function
 */
const requirePermission = (feature) => {
  return (req, res, next) => {
    if (!groupService) {
      // If group service not initialized, allow access (fallback to basic auth)
      return next();
    }

    // Admins always have access
    if (req.user?.isAdmin) {
      return next();
    }

    const hasPermission = groupService.userHasPermission(
      req.user?.id,
      feature,
      req.user?.isAdmin || false
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Access denied',
        message: `You do not have permission to use ${feature}`,
        requiredFeature: feature
      });
    }

    next();
  };
};

/**
 * Middleware to attach user permissions to request
 */
const attachPermissions = (req, res, next) => {
  if (!groupService || !req.user) {
    return next();
  }

  req.userPermissions = groupService.getUserPermissions(
    req.user.id,
    req.user.isAdmin || false
  );
  req.userGroups = groupService.getUserGroups(req.user.id);

  next();
};

/**
 * Creates middleware that checks if user has ANY of the specified permissions
 * @param {string[]} features - Array of features (any one match grants access)
 * @returns {Function} Express middleware function
 */
const requireAnyPermission = (features) => {
  return (req, res, next) => {
    if (!groupService) {
      return next();
    }

    if (req.user?.isAdmin) {
      return next();
    }

    const hasAnyPermission = features.some(feature =>
      groupService.userHasPermission(req.user?.id, feature, req.user?.isAdmin || false)
    );

    if (!hasAnyPermission) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission for this action',
        requiredFeatures: features
      });
    }

    next();
  };
};

/**
 * Creates middleware that checks if user has ALL of the specified permissions
 * @param {string[]} features - Array of features (all must match)
 * @returns {Function} Express middleware function
 */
const requireAllPermissions = (features) => {
  return (req, res, next) => {
    if (!groupService) {
      return next();
    }

    if (req.user?.isAdmin) {
      return next();
    }

    const hasAllPermissions = features.every(feature =>
      groupService.userHasPermission(req.user?.id, feature, req.user?.isAdmin || false)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have all required permissions for this action',
        requiredFeatures: features
      });
    }

    next();
  };
};

module.exports = {
  initialize,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  attachPermissions
};
