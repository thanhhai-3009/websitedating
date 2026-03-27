const mongoose = require('mongoose');
const GroupDate = require('../models/GroupDate');

class GroupService {
  /**
   * Attempt to join a user into a group using an atomic update.
   * Returns the updated group on success.
   * Throws an Error with clear message on failure.
   */
  static async joinGroup(userId, groupId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new Error('Invalid userId');
    if (!mongoose.Types.ObjectId.isValid(groupId)) throw new Error('Invalid groupId');

    // Try atomic update: only when status is OPEN, user not already in members, and members.length < maxMembers
    const filter = {
      _id: groupId,
      status: 'OPEN',
      members: { $ne: mongoose.Types.ObjectId(userId) },
      $expr: { $lt: [{ $size: '$members' }, '$maxMembers'] }
    };

    const update = { $push: { members: mongoose.Types.ObjectId(userId) } };

    // new: true returns the document after update if update succeeded
    const updated = await GroupDate.findOneAndUpdate(filter, update, { new: true }).exec();

    if (updated) {
      // If we reached maxMembers, set status to FULL (best-effort; another concurrent op may race)
      try {
        if (updated.members.length >= updated.maxMembers && updated.status !== 'FULL') {
          await GroupDate.findByIdAndUpdate(updated._id, { status: 'FULL' }).exec();
          updated.status = 'FULL';
        }
      } catch (e) {
        // non-fatal: membership already added; log if you have logger
      }
      return updated;
    }

    // If update returned null, fetch group to determine reason
    const group = await GroupDate.findById(groupId).lean().exec();
    if (!group) throw new Error('Group not found');
    if (group.status !== 'OPEN') throw new Error(`Group is not open (current status: ${group.status})`);
    if (group.members && group.members.some(m => String(m) === String(userId))) throw new Error('User is already a member of this group');
    if ((group.members || []).length >= group.maxMembers) throw new Error('Group is full');

    // Fallback generic message
    throw new Error('Could not join group due to concurrent update. Please retry');
  }

  /**
   * Search groups by overlapping tags / interests.
   * userInterests: array of strings
   */
  static async searchGroups(userInterests = []) {
    if (!Array.isArray(userInterests)) throw new Error('userInterests must be an array of strings');

    // aggregation pipeline:
    // 1) only future events
    // 2) tags intersect with userInterests
    // 3) add "matchCount" = size(setIntersection(tags, userInterests))
    // 4) sort by matchCount desc
    const now = new Date();

    const pipeline = [
      { $match: { eventDate: { $gt: now } } },
      { $match: { tags: { $in: userInterests } } },
      {
        $addFields: {
          matchTags: { $setIntersection: ['$tags', userInterests] }
        }
      },
      { $addFields: { matchCount: { $size: '$matchTags' } } },
      { $sort: { matchCount: -1, eventDate: 1 } },
      { $project: { matchTags: 1, matchCount: 1, title: 1, description: 1, category: 1, tags: 1, maxMembers: 1, members: 1, hostId: 1, status: 1, eventDate: 1 } }
    ];

    const results = await GroupDate.aggregate(pipeline).exec();
    return results;
  }
}

module.exports = GroupService;
