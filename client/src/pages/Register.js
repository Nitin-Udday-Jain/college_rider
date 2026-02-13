import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { 
  Container, 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Link, 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel 
} from '@mui/material'; // Import MUI components

function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student', // Default role
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/auth/register', formData);
      console.log('User registered successfully:', response.data);
      alert('Registration successful! Please log in.');
      navigate('/login'); // Redirect to login page after successful registration
    } catch (error) {
      console.error('There was an error registering!', error);
      alert('Error during registration.');
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h5">
          Sign Up
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="name"
            label="Name"
            name="name"
            autoComplete="name"
            autoFocus
            value={formData.name}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={handleChange}
          />
          {/* MUI Select component for Role */}
          <FormControl fullWidth margin="normal">
            <InputLabel id="role-select-label">Role</InputLabel>
            <Select
              labelId="role-select-label"
              id="role-select"
              name="role"
              value={formData.role}
              label="Role"
              onChange={handleChange}
            >
              <MenuItem value="student">Student</MenuItem>
              <MenuItem value="driver">Driver</MenuItem>
            </Select>
          </FormControl>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            Sign Up
          </Button>
          <Link component={RouterLink} to="/login" variant="body2">
            {"Already have an account? Sign In"}
          </Link>
        </Box>
      </Box>
    </Container>
  );
}
export default Register;