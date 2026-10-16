require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const Booking = require('./models/Booking');

// --- 1. HELPER FUNCTION: Calculate Distance ---
function getDistance(coord1, coord2) {
  if (!coord1 || !coord1.lat || !coord1.lng || !coord2 || !coord2.lat || !coord2.lng) {
    return Infinity;
  }
  const R = 6371;
  const dLat = (coord2.lat - coord1.lat) * (Math.PI / 180);
  const dLng = (coord2.lng - coord1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * (Math.PI / 180)) *
    Math.cos(coord2.lat * (Math.PI / 180)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
// ----------------------------------------------

let availableDrivers = [];
const allSockets = {};
const rideTimeouts = {}; // <-- 2. NEW: Track timeouts

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

function dispatchToNextDriver(booking, drivers) {
  if (drivers.length === 0) {
    console.log(`No more drivers available for booking ${booking._id}`);
    return;
  }
  const driver = drivers.shift();
  io.to(driver.socketId).emit('newRideRequest', booking);
  rideTimeouts[booking._id] = setTimeout(() => dispatchToNextDriver(booking, drivers), 30000);
}

function startDispatchWaterfall(booking) {
  const drivers = availableDrivers
    .filter(driver => driver.location)
    .sort((a, b) => getDistance(booking.pickupLocation, a.location) - getDistance(booking.pickupLocation, b.location));
  dispatchToNextDriver(booking, drivers);
}

app.use((req, res, next) => {
  req.io = io;
  req.availableDrivers = availableDrivers;
  req.startDispatchWaterfall = startDispatchWaterfall;
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);

io.on('connection', (socket) => {
  console.log('🔌 A user connected:', socket.id);

  socket.on('registerUser', (userId) => {
    allSockets[userId] = socket.id;
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });

  socket.on('driverGoesOnline', (data) => {
    console.log(`Driver ${data.driverId} is online.`);
    if (!availableDrivers.some(d => d.driverId === data.driverId)) {
      availableDrivers.push({
        driverId: data.driverId,
        socketId: socket.id,
        location: data.location
      });
    }
    console.log('Available drivers:', availableDrivers);
  });

  // --- 5. UPDATED: Clear Timeout on Accept ---
  socket.on('driverAcceptsRide', async (data) => {
    try {
      // Clear the timeout if it exists!
      if (rideTimeouts[data.bookingId]) {
        clearTimeout(rideTimeouts[data.bookingId]);
        delete rideTimeouts[data.bookingId];
        console.log(`Timeout cleared for booking ${data.bookingId}`);
      }

      console.log(`Driver ${data.driverId} accepting ride: ${data.bookingId}`);
     
      const updatedBooking = await Booking.findByIdAndUpdate(
        data.bookingId,
        { status: 'accepted', driver: data.driverId },
        { new: true }
      ).populate('driver', 'name vehicleModel vehiclePlate');

      const studentId = updatedBooking.student.toString();
      const studentSocketId = allSockets[studentId];
      if (studentSocketId) {
        io.to(studentSocketId).emit('rideAccepted', updatedBooking);
        console.log(`Notified student ${studentId} at socket ${studentSocketId}`);
      }
    } catch (err) {
      console.error("Error accepting ride:", err);
    }
  });

  // Listener for Pickup
  socket.on('driverPickedUpStudent', async (data) => {
    try {
      console.log('Driver picked up student for ride:', data.bookingId);
      const updatedBooking = await Booking.findByIdAndUpdate(
        data.bookingId, { status: 'ongoing' }, { new: true }
      );
      // Notify student (Optional)
      const studentId = updatedBooking.student.toString();
      if (allSockets[studentId]) io.to(allSockets[studentId]).emit('rideStatusUpdate', updatedBooking);
    } catch (err) { console.error("Error updating status to ongoing:", err); }
  });

  // Listener for Completion
  socket.on('driverCompletedRide', async (data) => {
    try {
      console.log('Driver completed ride:', data.bookingId);
      const updatedBooking = await Booking.findByIdAndUpdate(
        data.bookingId, { status: 'completed', paymentStatus: 'paid' }, { new: true }
      );
      // Notify student (Optional)
      const studentId = updatedBooking.student.toString();
      if (allSockets[studentId]) io.to(allSockets[studentId]).emit('rideStatusUpdate', updatedBooking);
    } catch (err) { console.error("Error updating status to completed:", err); }
  });

  // Driver Location Update
  socket.on('driverLocationUpdate', async (data) => {
    try {
      const booking = await Booking.findById(data.bookingId);
      if (!booking) return;
      const studentId = booking.student.toString();
      const studentSocketId = allSockets[studentId];
      if (studentSocketId) {
        io.to(studentSocketId).emit('driverLocation', {
          driverId: data.driverId,
          location: data.location
        });
      }
    } catch (err) { console.error("Error relaying driver location:", err); }
  });

  socket.on('disconnect', () => {
    console.log('👋 User disconnected:', socket.id);
    availableDrivers = availableDrivers.filter(
      (driver) => driver.socketId !== socket.id
    );
    for (const userId in allSockets) {
      if (allSockets[userId] === socket.id) {
        delete allSockets[userId];
        console.log(`User ${userId} removed from socket registry.`);
        break;
      }
    }
    console.log('Available drivers:', availableDrivers);
  });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });

  socket.on('cancelRide', async ({ bookingId, role }) => {
    try {
      if (rideTimeouts[bookingId]) { clearTimeout(rideTimeouts[bookingId]); delete rideTimeouts[bookingId]; }
      const booking = await Booking.findByIdAndUpdate(
        bookingId,
        { status: 'cancelled', paymentStatus: 'refunded' },
        { new: true }
      );
      if (!booking) return;
      const payload = { bookingId, source: role, refund: booking.estimatedFare };
      if (role === 'student') io.emit('rideCancelled', payload);
      else if (allSockets[booking.student.toString()]) io.to(allSockets[booking.student.toString()]).emit('rideCancelled', payload);
    } catch (err) { console.error('Error cancelling ride:', err); }
  });
