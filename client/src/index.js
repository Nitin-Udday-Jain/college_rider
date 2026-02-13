import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import './index.css';
import App from './App';
import Register from './pages/Register';
import Login from './pages/Login';
import Home from './pages/Home'; // Make sure all pages are imported
import DriverDashboard from './pages/DriverDashboard';

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      {
        path: "register",
        element: <Register />,
      },
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "driver-dashboard",
        element: <DriverDashboard />,
      },
    ],
  },
]);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <RouterProvider router={router} />
);