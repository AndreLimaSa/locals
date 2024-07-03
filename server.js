const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const app = express();
const PORT = process.env.PORT || 3000;

dotenv.config();

app.use(express.json()); // Middleware to parse JSON bodies
app.use(
  cors({
    origin: "https://locals-v1.onrender.com/", // Update this to your actual frontend URL
  })
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); // Middleware to parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// MongoDB connection URIs
const locationsURI = process.env.LOCATIONS_URI;
const usersURI = process.env.USERS_URI;

// Connect to MongoDB for locations
const locationsConnection = mongoose.createConnection(locationsURI, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
});

locationsConnection.on("connected", () => {
  console.log("Connected to MongoDB (locations)");
});

locationsConnection.on("error", (err) => {
  console.error("Connection error (locations):", err);
});

// Create Location model using the locationsConnection
const Location = locationsConnection.model(
  "Location",
  new mongoose.Schema({
    src: String,
    title: String,
    description: String,
    typeicon: String,
    types: [String],
    latitude: Number,
    longitude: Number,
    url: String,
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
  })
);

// Connect to MongoDB for users
const usersConnection = mongoose.createConnection(usersURI, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
});

usersConnection.on("connected", () => {
  console.log("Connected to MongoDB (users)");
});

usersConnection.on("error", (err) => {
  console.error("Connection error (users):", err);
});

// Create User model using the usersConnection
const User = usersConnection.model(
  "User",
  new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Location" }], // Reference to Location model
  })
);

// Function to generate JWT token
function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "1h" }
  );
}

// Middleware to verify token and authenticate requests
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send("Unauthorized");
  }

  // Log the token here
  console.log("Received token:", token);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      console.error("JWT verification error:", err);
      return res.status(403).send("Forbidden");
    }
    req.user = user;
    next(); // Pass the request to the next middleware or route handler
  });
}

// Registration route
app.post("/register", async (req, res) => {
  try {
    console.log("Registration request received");
    console.log("Request body:", req.body); // Log request body for debugging

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const newUser = new User({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
    });

    await newUser.save();
    console.log("New user registered:", newUser); // Log the new user

    res.redirect("/login");
  } catch (err) {
    if (err.code === 11000) {
      console.error("Error registering user: Duplicate email");
      res
        .status(400)
        .send("Email already exists. Please use a different email.");
    } else {
      console.error("Error registering user:", err);
      res.status(500).send("Error registering user. Please try again.");
    }
  }
});

app.post("/login", async (req, res) => {
  try {
    console.log("Login request received");
    console.log("Request body:", req.body); // Log request body for debugging

    const user = await User.findOne({ email: req.body.email });
    console.log("User found:", user); // Log the user object

    if (!user) {
      return res.status(400).send("Cannot find user");
    }

    if (await bcrypt.compare(req.body.password, user.password)) {
      // Generate token
      const token = generateToken(user);
      console.log("Generated token:", token); // Log the token

      // Send token and redirect URL
      res.json({
        accessToken: token,
        redirectUrl: "https://locals-v1.onrender.com/index.html", // Update this to your actual frontend URL
      });
    } else {
      res.status(401).send("Not Allowed");
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send();
  }
});

// Endpoint to get all locations
app.get("/locations", async (req, res) => {
  try {
    const locations = await Location.find();
    res.json(locations);
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Endpoint to like a location
app.post("/locations/:locationId/like", authenticateToken, async (req, res) => {
  const locationId = req.params.locationId;
  try {
    const updatedLocation = await Location.findByIdAndUpdate(
      locationId,
      { $inc: { likes: 1 } },
      { new: true }
    );

    if (!updatedLocation) {
      return res.status(404).send("Location not found");
    }

    res.json(updatedLocation);
  } catch (error) {
    console.error("Error liking location:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to dislike a location
app.post(
  "/locations/:locationId/dislike",
  authenticateToken,
  async (req, res) => {
    const locationId = req.params.locationId;
    try {
      const updatedLocation = await Location.findByIdAndUpdate(
        locationId,
        { $inc: { dislikes: 1 } },
        { new: true }
      );

      if (!updatedLocation) {
        return res.status(404).send("Location not found");
      }

      res.json(updatedLocation);
    } catch (error) {
      console.error("Error disliking location:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

// Route to save a favorite location
app.post("/favorites/:locationId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const locationId = req.params.locationId;

    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Check if the location is already in favorites
    if (user.favorites.includes(locationId)) {
      return res.status(400).send("Location already in favorites");
    }

    // Add the location to favorites
    user.favorites.push(locationId);
    await user.save();

    console.log("Favorites after saving:", user.favorites); // Log the favorites array after saving

    res.status(200).json({ message: "Location saved to favorites" });
  } catch (error) {
    console.error("Error saving favorite location:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Route for the main index.html file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Serve static files from the root directory
app.use(express.static(__dirname));

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "register.html"));
});

app.get("/favorites.html", (req, res) => {
  res.sendFile(path.join(__dirname, "favorites.html"));
});

// Route to get favorite locations
app.get("/favorites", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("User ID:", userId);

    const user = await User.findById(userId).populate({
      path: "favorites",
      model: Location,
    });

    if (!user) {
      return res.status(404).send("User not found");
    }

    console.log("Populated favorites:", user.favorites); // Log the populated favorites

    res.status(200).json(user.favorites);
  } catch (error) {
    console.error("Error fetching favorite locations:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
