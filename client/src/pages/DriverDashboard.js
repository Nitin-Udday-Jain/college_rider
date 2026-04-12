import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
// --- 1. IMPORT MUI COMPONENTS ---
import { Box, Typography, Button, Card, CardContent, CardActions, Container } from '@mui/material';

function DriverDashboard() {
  const [rideRequests, setRideRequests] = useState([]);
  const [ongoingRide, setOngoingRide] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const watchIdRef = useRef(null);
  const [user, setUser] = useState(null);
  const socketRef = useRef(null);

  // Get user from local storage
  useEffect(() => {
    const loggedInUser = localStorage.getItem('user');
    if (loggedInUser) {
      setUser(JSON.parse(loggedInUser));
    }
  }, []);

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const response = await fetch(`http://localhost:5000/api/bookings/history/${user._id}`);
      const data = await response.json();
      setHistory(data);
      setShowHistory(true);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  // Socket connection logic
  useEffect(() => {
    if (user && user.role === 'driver') {
      socketRef.current = io('http://localhost:5000');
      const socket = socketRef.current;

      socket.on('connect', () => {
        console.log('Driver Dashboard Socket connected:', socket.id);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const driverLocation = { lat: latitude, lng: longitude };
            socket.emit('driverGoesOnline', { driverId: user._id, location: driverLocation });
            socket.emit('registerUser', user._id);
          },
          (error) => {
            console.error("Error getting driver location:", error);
            socket.emit('driverGoesOnline', { driverId: user._id, location: null });
            socket.emit('registerUser', user._id);
          }
        );
      });

      socket.on('newRideRequest', (booking) => {
        console.log('New ride request received:', booking);
        setRideRequests((prevRequests) => [booking, ...prevRequests]);
      });

      socket.on('rideCancelled', (data) => {
        if (data.source === 'student') {
           setRideRequests((prevRequests) => prevRequests.filter(r => r._id !== data.bookingId));
           setOngoingRide((prev) => {
             if (prev && prev._id === data.bookingId) {
               alert("The student has cancelled the active ride.");
               return null;
             }
             return prev;
           });
        }
      });

      socket.on('disconnect', () => {
        console.log('Driver Dashboard Socket disconnected.');
      });

      return () => {
        console.log('Cleaning up Driver Dashboard socket...');
        socket.disconnect();
        if (watchIdRef.current) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
      };
    }
  }, [user]);

  // handleAcceptRide function (no changes)
  const handleAcceptRide = (ride) => {
    const socket = socketRef.current;
    if (!user || !socket) return;

    console.log(`Driver ${user._id} accepting ride: ${ride._id}`);
    socket.emit('driverAcceptsRide', { bookingId: ride._id, driverId: user._id });

    const acceptedRide = { ...ride, status: 'accepted' };
    setOngoingRide(acceptedRide);
    setRideRequests((prevRequests) =>
      prevRequests.filter((r) => r._id !== ride._id)
    );

    if (navigator.geolocation) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log(`Sending location: ${latitude}, ${longitude}`);
          socket.emit('driverLocationUpdate', {
            bookingId: ride._id,
            driverId: user._id,
            location: { lat: latitude, lng: longitude }
          });
        },
        (error) => console.error("Error watching location:", error),
        { enableHighAccuracy: true }
      );
    }
  };

  // handlePickup function (no changes)
  const handlePickup = () => {
    const socket = socketRef.current;
    if (!socket || !ongoingRide) return;
    
    console.log('Driver picked up student for ride:', ongoingRide._id);
    socket.emit('driverPickedUpStudent', { bookingId: ongoingRide._id });
    setOngoingRide({ ...ongoingRide, status: 'ongoing' });
  };

  // handleComplete function (no changes)
  const handleComplete = () => {
    const socket = socketRef.current;
    if (!socket || !ongoingRide) return;

    console.log('Driver completed ride:', ongoingRide._id);
    socket.emit('driverCompletedRide', { bookingId: ongoingRide._id });

    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setOngoingRide(null);
  };
  
  // Conditional rendering (no changes)
  if (!user) {
    return (
      <Container>
        <Typography>Loading user data...</Typography>
      </Container>
    );
  }
  if (user.role !== 'driver') {
    return (
      <Container>
        <Typography variant="h5" color="error">
          Access Denied. This page is for drivers only.
        </Typography>
      </Container>
    );
  }

  // --- 2. UPDATED JSX WITH MUI ---
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">
            Driver Dashboard
          </Typography>
          <Button variant="outlined" onClick={() => showHistory ? setShowHistory(false) : fetchHistory()}>
            {showHistory ? 'Hide History' : 'Ride History'}
          </Button>
        </Box>
        <Typography variant="h6" gutterBottom>Welcome, {user.name}!</Typography>

        {/* --- Current Ride Section --- */}
        {ongoingRide && (
          <Box sx={{ my: 3 }}>
            <Typography variant="h5" gutterBottom>Current Ride</Typography>
            <Card variant="outlined" sx={{ borderColor: 'primary.main', borderWidth: 2 }}>
              <CardContent>
                <Typography><strong>From:</strong> {ongoingRide.pickupLocation?.name}</Typography>
                <Typography><strong>To:</strong> {ongoingRide.destinationLocation?.name}</Typography>
                <Typography><strong>Distance:</strong> {ongoingRide.distance} km</Typography>
                <Typography><strong>Estimated Fare:</strong> ₹{ongoingRide.estimatedFare}</Typography>
                <Typography><strong>Status:</strong> {ongoingRide.status}</Typography>
              </CardContent>
              <CardActions>
                {ongoingRide.status === 'accepted' && (
                  <>
                    <Button variant="contained" color="success" onClick={handlePickup}>
                      Mark as Picked Up
                    </Button>
                    <Button variant="outlined" color="error" onClick={() => {
                       socketRef.current.emit('cancelRide', { bookingId: ongoingRide._id, role: 'driver' });
                       setOngoingRide(null);
                    }} sx={{ ml: 2 }}>
                      Cancel Ride
                    </Button>
                  </>
                )}
                {ongoingRide.status === 'ongoing' && (
                  <Button variant="contained" color="primary" onClick={handleComplete}>
                    Mark as Completed
                  </Button>
                )}
              </CardActions>
            </Card>
          </Box>
        )}

        {/* --- Ride History Section --- */}
        {showHistory && (
          <Box sx={{ mt: 4, p: 2, bgcolor: '#f9f9f9', borderRadius: 1 }}>
            <Typography variant="h5" gutterBottom>Ride History</Typography>
            {history.length === 0 ? (
              <Typography>No past rides found.</Typography>
            ) : (
              history.map((ride) => (
                <Card key={ride._id} variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography><strong>Date:</strong> {new Date(ride.createdAt).toLocaleString()}</Typography>
                    <Typography><strong>From:</strong> {ride.pickupLocation?.name}</Typography>
                    <Typography><strong>To:</strong> {ride.destinationLocation?.name}</Typography>
                    <Typography><strong>Status:</strong> {ride.status}</Typography>
                    {ride.distance && <Typography><strong>Distance:</strong> {ride.distance} km</Typography>}
                    {ride.estimatedFare && <Typography><strong>Fare:</strong> ₹{ride.estimatedFare}</Typography>}
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        )}

        {/* --- New Ride Requests Section --- */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>New Ride Requests (Real-Time)</Typography>
          <Box sx={{ border: '1px solid #ccc', p: 2, minHeight: '300px', borderRadius: 1 }}>
            {rideRequests.length === 0 && !ongoingRide ? (
              <Typography>Waiting for new ride requests...</Typography>
            ) : (
              rideRequests.map((ride) => (
                <Card key={ride._id} variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography><strong>From:</strong> {ride.pickupLocation?.name}</Typography>
                    <Typography><strong>To:</strong> {ride.destinationLocation?.name}</Typography>
                    {ride.distance && <Typography><strong>Distance:</strong> {ride.distance} km</Typography>}
                    {ride.estimatedFare && <Typography><strong>Estimated Fare:</strong> ₹{ride.estimatedFare}</Typography>}
                  </CardContent>
                  <CardActions>
                    <Button variant="contained" onClick={() => handleAcceptRide(ride)}>
                      Accept Ride
                    </Button>
                  </CardActions>
                </Card>
              ))
            )}
          </Box>
        </Box>
      </Box>
    </Container>
  );
}

export default DriverDashboard;