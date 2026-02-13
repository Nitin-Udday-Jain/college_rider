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
  const [driverLocation, setDriverLocation] = useState(null);
  const [user, setUser] = useState(null);
  const mapRef = useRef(null);

  // Get user from local storage
  useEffect(() => {
    const loggedInUser = localStorage.getItem('user');
    if (loggedInUser) {
      setUser(JSON.parse(loggedInUser));
    }
  }, []);

  // Socket connection logic
  useEffect(() => {
    if (user && user.role === 'student') {
      const socket = io('http://localhost:5000');
      socket.on('connect', () => {
        console.log('Home page connected to socket:', socket.id);
        socket.emit('registerUser', user._id);
      });
      socket.on('rideAccepted', (booking) => {
        console.log('Your ride was accepted!', booking);
        alert(`Your ride to ${booking.destinationLocation.name} has been accepted!`);
      });
      socket.on('driverLocation', (data) => {
        console.log('Driver location update received:', data.location);
        setDriverLocation(data.location);
      });
      return () => {
        console.log('Cleaning up Home socket...');
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

  // handleSearch function (no changes)
  const handleSearch = async () => {
    setShowInitialMarker(false);
    setRoute([]);
    setDistance(null);
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
        const routeCoords = routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        setRoute(routeCoords);
      }
    } catch (error) {
      console.error("Error during search:", error);
    }
  };

  // handleBookingRequest function (no changes)
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
    };
    try {
      const response = await axios.post('http://localhost:5000/api/bookings/request', bookingData);
      console.log("Booking created successfully:", response.data);
      alert("Your ride has been successfully requested! Waiting for a driver...");
    } catch (error) {
      console.error("Booking failed:", error.response ? error.response.data : "Request failed");
      if (error.response && error.response.data && error.response.data.message) {
        alert(`Failed to request ride: ${error.response.data.message}`);
      } else {
        alert("Failed to request the ride. Please try again.");
      }
    }
  };

  // --- 2. UPDATED JSX WITH MUI COMPONENTS ---
  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 110px)' }}> {/* Full height minus AppBar */}
      
      {/* Search and Ride Details Panel */}
      <Paper elevation={3} sx={{ width: '350px', p: 2, overflowY: 'auto' }}>
        <Typography variant="h6" gutterBottom>
          Plan Your Ride
        </Typography>
        <Box component="form" noValidate sx={{ mt: 1 }}>
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
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleBookingRequest}
                sx={{ mt: 2 }}
              >
                Request Ride
              </Button>
            </Box>
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