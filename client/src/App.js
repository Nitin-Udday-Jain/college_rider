import React from 'react';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material'; // Import AppBar components

function App() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* AppBar is the main navigation bar */}
      <AppBar position="static">
        <Toolbar>
          {/* App Title */}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            College Rider App
          </Typography>

          {/* Navigation Links as Buttons */}
          <Button color="inherit" component={RouterLink} to="/">
            Home
          </Button>
          <Button color="inherit" component={RouterLink} to="/register">
            Register
          </Button>
          <Button color="inherit" component={RouterLink} to="/login">
            Login
          </Button>
          <Button color="inherit" component={RouterLink} to="/driver-dashboard">
            Driver Dashboard
          </Button>
        </Toolbar>
      </AppBar>

      {/* Main content area */}
      <Box component="main" sx={{ p: 3 }}>
        {/* Your pages (Home, Login, etc.) will be rendered here */}
        <Outlet />
      </Box>
    </Box>
  );
}

export default App;