function getDistance(coord1, coord2) {
  if (!coord1 || !coord2) {
    return Infinity; // Can't calculate distance if location is missing
  }

  const R = 6371; // Radius of the Earth in km
  const dLat = (coord2.lat - coord1.lat) * (Math.PI / 180);
  const dLng = (coord2.lng - coord1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * (Math.PI / 180)) *
    Math.cos(coord2.lat * (Math.PI / 180)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}
const router = require('express').Router();
const Booking = require('../models/Booking');

router.post('/request', async (req, res) => {
  try {
    const availableDrivers = req.availableDrivers;
    if (availableDrivers.length === 0) {
      return res.status(400).json({ message: "No drivers are currently available." });
    }

    // 1. Create the new booking WITHOUT an initially assigned driver
    const newBooking = new Booking({
      student: req.body.studentId,
      pickupLocation: req.body.pickupLocation,
      destinationLocation: req.body.dropoffLocation,
      distance: req.body.distance,
      estimatedFare: req.body.estimatedFare,
    });

    const savedBooking = await newBooking.save();

    // 2. Trigger the waterfall dispatch logic
    req.startDispatchWaterfall(savedBooking);
    
    // 3. Send success back to the student
    res.status(201).json(savedBooking);

  } catch (err) {
    console.error("Booking creation failed:", err);
    res.status(500).json(err);
  }
});

// GET user's ride history
router.get('/history/:userId', async (req, res) => {
  try {
    const rides = await Booking.find({
      $or: [
        { student: req.params.userId },
        { driver: req.params.userId }
      ]
    })
    .sort({ createdAt: -1 })
    .populate('driver', 'name vehicleModel vehiclePlate')
    .populate('student', 'name');

    res.status(200).json(rides);
  } catch (err) {
    console.error("Error fetching ride history:", err);
    res.status(500).json(err);
  }
});

module.exports = router;