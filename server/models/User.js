const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true // No two users can have the same email
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'driver'], // The role must be one of these two options
    required: true
  }
}, { timestamps: true }); // Automatically adds 'createdAt' and 'updatedAt' fields

module.exports = mongoose.model('User', UserSchema);