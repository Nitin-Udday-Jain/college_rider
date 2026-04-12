const router = require('express').Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// REGISTER a new user
router.post('/register', async (req, res) => {
  try {
    // Check if user already exists
    const userExists = await User.findOne({ email: req.body.email });
    if (userExists) {
      return res.status(400).json("An account with this email already exists.");
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    // Create a new user object
    const newUser = new User({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
      role: req.body.role,
      vehicleModel: req.body.role === 'driver' ? req.body.vehicleModel : undefined,
      vehiclePlate: req.body.role === 'driver' ? req.body.vehiclePlate : undefined,
    });

    // Save the user to the database
    const user = await newUser.save();
    res.status(201).json(user); // Send back the created user

  } catch (err) {
    res.status(500).json(err); // Handle server errors
  }
});

// LOGIN
// ... (inside server/routes/auth.js)

// LOGIN
router.post('/login', async (req, res) => {
  try {
    // 1. Check if the user exists
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(400).json("Invalid credentials"); // Keep error generic
    }

    // 2. Check if the password is correct
    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) {
      return res.status(400).json("Invalid credentials"); // Keep error generic
    }
    // 3. If everything is correct, send back user data (WITHOUT the password)
    const { password, ...userData } = user._doc; // Destructure to remove password
    res.status(200).json(userData); // Send the user data

  } catch (err) {
    res.status(500).json(err);
  }
});

// ... (module.exports)

module.exports = router;