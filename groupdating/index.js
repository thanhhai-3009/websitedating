const express = require('express');
const router = express.Router();
const groupRoutes = require('./routes/groupRoutes');

module.exports = function mountGroupDating(app) {
  // mount under /api/groups
  app.use('/api/groups', groupRoutes);
};
