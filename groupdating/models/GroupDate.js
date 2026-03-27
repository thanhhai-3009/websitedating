const mongoose = require('mongoose');
const { Schema } = mongoose;

const GroupDateSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String, enum: ['Dining', 'Travel', 'Hangout'], default: 'Hangout' },
  tags: [{ type: String }],
  maxMembers: { type: Number, required: true, min: 1 },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['OPEN', 'FULL', 'CLOSED'], default: 'OPEN' },
  eventDate: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('GroupDate', GroupDateSchema);
