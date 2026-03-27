const mongoose = require('mongoose');

/**
 * Middleware factory that ensures the hostId in the request body refers to a verified user.
 * Usage: router.post('/', ensureVerifiedHost(), handler)
 * If you want to pass a custom User model (project-specific), call ensureVerifiedHost(UserModel)
 */
function ensureVerifiedHost(UserModel) {
  const UM = UserModel || (mongoose.models && mongoose.models.User) || null;
  if (!UM) {
    // return middleware that fails fast with clear message
    return async function (req, res, next) {
      return res.status(500).json({ error: 'User model not available for verification' });
    };
  }

  return async function (req, res, next) {
    try {
      const hostId = req.body && req.body.hostId;
      if (!hostId) return res.status(400).json({ error: 'hostId is required' });
      if (!mongoose.Types.ObjectId.isValid(hostId)) return res.status(400).json({ error: 'hostId is not a valid id' });

      const user = await UM.findById(hostId).lean().exec();
      if (!user) return res.status(404).json({ error: 'Host user not found' });
      if (!user.isVerified) return res.status(403).json({ error: 'Host user must be verified to create a group' });
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = ensureVerifiedHost;
