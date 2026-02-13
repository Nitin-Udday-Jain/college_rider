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
    // 1. Get pickup location from the student's request
    const pickupLocation = req.body.pickupLocation;

    // 2. Find all available drivers
    const availableDrivers = req.availableDrivers;
    if (availableDrivers.length === 0) {
      return res.status(400).json({ message: "No drivers are currently available." });
    }

    // --- 3. NEW: Find the closest driver ---
    let closestDriver = null;
    let minDistance = Infinity;

    for (const driver of availableDrivers) {
      if (driver.location) { // Check if the driver has a location
        const distance = getDistance(pickupLocation, driver.location);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestDriver = driver;
        }
      }
    }

    // If no drivers had a valid location
    if (!closestDriver) {
      return res.status(400).json({ message: "No drivers with a valid location are available." });
    }
    // ------------------------------------

    // 4. Create the new booking using the closest driver
    const newBooking = new Booking({
      student: req.body.studentId,
      driver: closestDriver.driverId, // Assign the ride to the closest driver
      pickupLocation: req.body.pickupLocation,
      destinationLocation: req.body.dropoffLocation,
    });

    const savedBooking = await newBooking.save();

    // 5. Send the ride request *only* to the closest driver's socket
    req.io.to(closestDriver.socketId).emit('newRideRequest', savedBooking);
    
    // 6. Send success back to the student
    res.status(201).json(savedBooking);

  } catch (err) {
    console.error("Booking creation failed:", err);
    res.status(500).json(err);
  }
});

module.exports = router;