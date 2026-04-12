const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // This links to a document in the User collection
    required: true,
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // Driver isn't required initially, can be assigned later
  },
  pickupLocation: {
    name: { type: String },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  destinationLocation: {
    name: { type: String },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  distance: {
    type: Number, // Distance in km
  },
  estimatedFare: {
    type: Number, // Estimated fare in INR
  },
  status: {
        type: String,
        enum: ['requested', 'accepted', 'ongoing', 'completed', 'cancelled'], // <-- Make sure all 5 are here
        default: 'requested',
  },
}, { timestamps: true });

module.exports = mongoose.model('Booking', BookingSchema);