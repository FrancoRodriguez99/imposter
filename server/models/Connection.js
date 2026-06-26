import mongoose from 'mongoose';

const connectionSchema = new mongoose.Schema({
  socketId:       { type: String, index: true },
  ip:             String,
  userAgent:      String,
  browser:        String,
  os:             String,
  deviceType:     String,   // 'mobile' | 'tablet' | 'desktop' | 'bot'
  acceptLanguage: String,
  connectedAt:    { type: Date, default: Date.now },
  disconnectedAt: Date,
  sessionSeconds: Number,
  roomsVisited:   [String],
  gamesPlayed:    { type: Number, default: 0 },
});

export default mongoose.model('Connection', connectionSchema);
