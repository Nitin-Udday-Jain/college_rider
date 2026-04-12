import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import io from 'socket.io-client';
// --- 1. IMPORT MUI COMPONENTS ---
import { Box, TextField, Button, Typography, Paper } from '@mui/material'; 

// --- Icon fix ---
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow });
L.Marker.prototype.options.icon = DefaultIcon;
// -----------------

const defaultPosition = [15.5168, 74.9287];

function Home() {
  const [position, setPosition] = useState(defaultPosition);
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [showInitialMarker, setShowInitialMarker] = useState(true);
  const [route, setRoute] = useState([]);
  const [distance, setDistance] = useState(null);
  const [estimatedFare, setEstimatedFare] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [user, setUser] = useState(null);
  const [driverDetails, setDriverDetails] = useState(null);
  const [rideStatus, setRideStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentBooking, setCurrentBooking] = useState(null);
  const mapRef = useRef(null);
  const socketRef = useRef(null);
  const latestBookingRef = useRef(null);

  // Sync ref
  useEffect(() => {
    latestBookingRef.current = currentBooking;
  }, [currentBooking]);

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
      const response = await axios.get(`http://localhost:5000/api/bookings/history/${user._id}`);
      setHistory(response.data);
      setShowHistory(true);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  // Socket connection logic
  useEffect(() => {
    if (user && user.role === 'student') {
      const socket = io('http://localhost:5000');
      socketRef.current = socket;
      socket.on('connect', () => {
        console.log('Home page connected to socket:', socket.id);
        socket.emit('registerUser', user._id);
      });
      socket.on('rideAccepted', (booking) => {
        console.log('Your ride was accepted!', booking);
        setRideStatus('accepted');
        if (booking.driver) {
          setDriverDetails(booking.driver); 
          alert(`${booking.driver.name} has accepted your ride arriving in a ${booking.driver.vehicleModel || 'vehicle'} (${booking.driver.vehiclePlate || 'N/A'}).`);
        }
      });
      socket.on('rideStatusUpdate', (booking) => {
        setRideStatus(booking.status);
        if (booking.status === 'completed') {
          alert('Your ride is completed. Thank you!');
          setDriverDetails(null);
          setRideStatus(null);
          setCurrentBooking(null);
          setRoute([]);
          setDistance(null);
          setEstimatedFare(null);
          setShowInitialMarker(true);
        }
      });
      socket.on('driverLocation', (data) => {
        setDriverLocation(data.location);
      });
      socket.on('rideCancelled', async (data) => {
        if (data.source === 'driver') {
          const shouldReSearch = window.confirm("The driver has cancelled the ride. Would you like to continue searching for other drivers?");
          if (shouldReSearch && latestBookingRef.current) {
             setRideStatus('requested');
             setDriverDetails(null);
             // Re-request using the saved booking data
             const bookingData = {
               studentId: user._id,
               pickupLocation: latestBookingRef.current.pickupLocation,
               dropoffLocation: latestBookingRef.current.destinationLocation,
               distance: latestBookingRef.current.distance,
               estimatedFare: latestBookingRef.current.estimatedFare,
             };
             try {
                const response = await axios.post('http://localhost:5000/api/bookings/request', bookingData);
                setCurrentBooking(response.data);
             } catch (err) { alert("Failed to re-request."); setRideStatus(null); }
          } else {
             setRideStatus(null);
             setCurrentBooking(null);
             setDriverDetails(null);
          }
        }
      });
      return () => {
        socket.disconnect();
      };
    }
  }, [user]);

  // Geolocation logic
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);
      }, (err) => { console.error("Error getting location:", err); }
    );
  }, []);

  // handleSearch function
  const handleSearch = async () => {
    setShowInitialMarker(false);
    setRoute([]);
    setDistance(null);
    setEstimatedFare(null);
    setShowHistory(false);
    let startPoint, endPoint;

    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const viewbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    try {
      if (pickup.trim() !== '') {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${pickup}&viewbox=${viewbox}&bounded=1`);
        const data = await res.json();
        if (data.length > 0) {
          startPoint = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          setPickupCoords(startPoint);
        }
      }
      if (destination.trim() !== '') {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${destination}&viewbox=${viewbox}&bounded=1`);
        const data = await res.json();
        if (data.length > 0) {
          endPoint = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          setDestinationCoords(endPoint);
        }
      }

      if (startPoint && endPoint) {
        const response = await fetch(`http://router.project-osrm.org/route/v1/driving/${startPoint[1]},${startPoint[0]};${endPoint[1]},${endPoint[0]}?overview=full&geometries=geojson`);
        const data = await response.json();
        const routeData = data.routes[0];
        const rideDistance = (routeData.distance / 1000).toFixed(2);
        setDistance(rideDistance);
        
        // Calculate fare (₹15 per km)
        const fare = Math.round(rideDistance * 15);
        setEstimatedFare(fare);

        const routeCoords = routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        setRoute(routeCoords);
      }
    } catch (error) {
      console.error("Error during search:", error);
    }
  };

  // handleBookingRequest function
  const handleBookingRequest = async () => {
    if (!user) {
      alert("Please log in to request a ride.");
      return;
    }
    if (!pickupCoords || !destinationCoords) {
      alert("Please set both pickup and destination locations.");
      return;
    }
    const bookingData = {
      studentId: user._id,
      pickupLocation: { name: pickup, lat: pickupCoords[0], lng: pickupCoords[1] },
      dropoffLocation: { name: destination, lat: destinationCoords[0], lng: destinationCoords[1] },
      distance: distance,
      estimatedFare: estimatedFare,
    };
    try {
      setRideStatus('requested');
      const response = await axios.post('http://localhost:5000/api/bookings/request', bookingData);
      console.log("Booking created successfully:", response.data);
      setCurrentBooking(response.data);
      alert("Your ride has been successfully requested! Waiting for a driver...");
    } catch (error) {
      console.error("Booking failed:", error.response ? error.response.data : "Request failed");
      setRideStatus(null);
      if (error.response && error.response.data && error.response.data.message) {
        alert(`Failed to request ride: ${error.response.data.message}`);
      } else {
        alert("Failed to request the ride. Please try again.");
      }
    }
  };

  const handleCancelRide = () => {
    if (socketRef.current && latestBookingRef.current) {
      socketRef.current.emit('cancelRide', { bookingId: latestBookingRef.current._id, role: 'student' });
      setRideStatus(null);
      setCurrentBooking(null);
      setDriverDetails(null);
      console.log("Ride cancelled.");
    }
  };

  // --- 2. UPDATED JSX WITH MUI COMPONENTS ---
  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 110px)' }}> {/* Full height minus AppBar */}
      
      {/* Search and Ride Details Panel */}
      <Paper elevation={3} sx={{ width: '350px', p: 2, overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Plan Your Ride
          </Typography>
          <Button size="small" variant="outlined" onClick={() => showHistory ? setShowHistory(false) : fetchHistory()}>
            {showHistory ? 'Close History' : 'Ride History'}
          </Button>
        </Box>
        <Box component="form" noValidate sx={{ mt: 1 }}>
          {showHistory ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>Previous Rides</Typography>
              {history.length === 0 ? (
                <Typography>No past rides found.</Typography>
              ) : (
                history.map((ride) => (
                  <Box key={ride._id} sx={{ mb: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                    <Typography variant="subtitle2">From: {ride.pickupLocation?.name}</Typography>
                    <Typography variant="subtitle2">To: {ride.destinationLocation?.name}</Typography>
                    <Typography variant="body2"><strong>Status:</strong> {ride.status}</Typography>
                    {ride.distance && <Typography variant="body2"><strong>Distance:</strong> {ride.distance} km</Typography>}
                    {ride.estimatedFare && <Typography variant="body2"><strong>Fare:</strong> ₹{ride.estimatedFare}</Typography>}
                    <Typography variant="caption" color="textSecondary">{new Date(ride.createdAt).toLocaleString()}</Typography>
                  </Box>
                ))
              )}
            </Box>
          ) : (
            <>
              <TextField
                label="Enter pickup location"
                variant="outlined"
                fullWidth
                margin="normal"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
              />
              <TextField
                label="Enter destination"
                variant="outlined"
                fullWidth
                margin="normal"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
              <Button
                variant="contained"
                fullWidth
                onClick={handleSearch}
                sx={{ mt: 2 }}
              >
                Search 🔍
              </Button>

              {distance && (
                <Box sx={{ mt: 3, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                  <Typography variant="h6">Ride Details</Typography>
                  <Typography>Distance: {distance} km</Typography>
                  {estimatedFare && <Typography>Estimated Fare: ₹{estimatedFare}</Typography>}
                  
                  {!rideStatus && (
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      onClick={handleBookingRequest}
                      sx={{ mt: 2 }}
                    >
                      Request Ride
                    </Button>
                  )}

                  {rideStatus === 'requested' && (
                    <Typography color="primary" sx={{ mt: 2 }}>Waiting for driver...</Typography>
                  )}

                  {(rideStatus === 'accepted' || rideStatus === 'ongoing') && driverDetails && (
                    <Box sx={{ mt: 2, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                      <Typography variant="subtitle2">Driver Details:</Typography>
                      <Typography variant="body2"><strong>Name:</strong> {driverDetails.name}</Typography>
                      <Typography variant="body2"><strong>Vehicle:</strong> {driverDetails.vehicleModel || 'N/A'}</Typography>
                      <Typography variant="body2"><strong>Plate:</strong> {driverDetails.vehiclePlate || 'N/A'}</Typography>
                      <Typography variant="body2" color="secondary" sx={{ mt: 1 }}>
                        Status: {rideStatus.toUpperCase()}
                      </Typography>
                    </Box>
                  )}

                  {(rideStatus === 'requested' || rideStatus === 'accepted') && (
                    <Button
                      variant="outlined"
                      color="error"
                      fullWidth
                      onClick={handleCancelRide}
                      sx={{ mt: 2 }}
                    >
                      Cancel Ride
                    </Button>
                  )}
                </Box>
              )}
            </>
          )}
        </Box>
      </Paper>

      {/* Map Area */}
      <Box sx={{ flexGrow: 1, height: '100%' }}>
        <MapContainer ref={mapRef} center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {showInitialMarker && <Marker position={position}><Popup>Current Location</Popup></Marker>}
          {pickupCoords && <Marker position={pickupCoords}><Popup>Pickup: {pickup}</Popup></Marker>}
          {destinationCoords && <Marker position={destinationCoords}><Popup>Destination: {destination}</Popup></Marker>}
          {route.length > 0 && <Polyline positions={route} color="blue" />}
          {driverLocation && (
            <Marker position={driverLocation}>
              <Popup>Driver</Popup>
            </Marker>
          )}
        </MapContainer>
      </Box>

    </Box>
  );
}

export default Home;