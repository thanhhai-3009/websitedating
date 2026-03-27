const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const GroupDate = require('../models/GroupDate');
const GroupService = require('../services/groupService');
const ensureVerifiedHost = require('../middleware/ensureVerifiedHost');

// Create group (host must be verified)
router.post('/', ensureVerifiedHost(), async (req, res, next) => {
  try {
    const payload = req.body;
    // minimal validation
    if (!payload.title || !payload.maxMembers || !payload.eventDate || !payload.hostId) {
      return res.status(400).json({ error: 'title, maxMembers, eventDate and hostId are required' });
    }

    const group = new GroupDate({
      title: payload.title,
      description: payload.description,
      category: payload.category,
      tags: payload.tags || [],
      maxMembers: payload.maxMembers,
      members: payload.members || [],
      hostId: payload.hostId,
      status: payload.status || 'OPEN',
      eventDate: new Date(payload.eventDate)
    });

    const saved = await group.save();
    return res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

// Join group
router.post('/:id/join', async (req, res, next) => {
  try {
    const userId = req.body.userId;
    const groupId = req.params.id;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
      const updated = await GroupService.joinGroup(userId, groupId);
      return res.json({ success: true, group: updated });
    } catch (joinErr) {
      return res.status(400).json({ error: joinErr.message });
    }
  } catch (err) {
    next(err);
  }
});

// Search groups by interests (query param: interests=tag1,tag2)
router.get('/search', async (req, res, next) => {
  try {
    const raw = req.query.interests || '';
    const interests = raw ? String(raw).split(',').map(s => s.trim()).filter(Boolean) : [];
    const results = await GroupService.searchGroups(interests);
    return res.json(results);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
