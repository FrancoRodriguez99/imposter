import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  name:       String,
  socketId:   String,
  ip:         String,
  browser:    String,
  os:         String,
  deviceType: String,
  isHost:     Boolean,
  isImpostor: Boolean,
}, { _id: false });

const gameSchema = new mongoose.Schema({
  roomId:          { type: String, index: true },
  startedAt:       { type: Date, default: Date.now },
  endedAt:         Date,
  durationSeconds: Number,
  word:            String,
  settings: {
    impostorCount: Number,
    randomCount:   Boolean,
    showImpostors: Boolean,
  },
  firstPlayer:  String,
  totalPlayers: Number,
  players:      [playerSchema],
  impostors:    [{ name: String, _id: false }],
  winner:       String,   // 'impostor' | null
  endReason:    String,   // 'impostor-guess' | 'host-ended'
  impostorGuess: String,
});

export default mongoose.model('Game', gameSchema);
