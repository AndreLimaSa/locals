const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const app = express();
const PORT = process.env.PORT || 3000;

dotenv.config();

const allowedOrigins = ["https://locals-v1.onrender.com"]; // Add more origins as needed

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
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

const User = usersConnection.model(
  "User",
  new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Location" }],
  })
);

function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "1h" }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send("Unauthorized");
  }

  console.log("Received token:", token);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      console.error("JWT verification error:", err);
      return res.status(403).send("Forbidden");
    }
    req.user = user;
    next();
  });
}

app.post("/register", async (req, res) => {
  try {
    console.log("Registration request received");
    console.log("Request body:", req.body);

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const newUser = new User({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
    });

    await newUser.save();
    console.log("New user registered:", newUser);

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
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({
      accessToken: token,
      redirectUrl: "https://locals-v1.onrender.com",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/locations", async (req, res) => {
  try {
    const locations = await Location.find();
    res.json(locations);
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ error: "Server error" });
  }
});

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

app.post("/favorites/:locationId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const locationId = req.params.locationId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found");
    }

    if (user.favorites.includes(locationId)) {
      return res.status(400).send("Location already in favorites");
    }

    user.favorites.push(locationId);
    await user.save();

    console.log("Favorites after saving:", user.favorites);

    res.status(200).json({ message: "Location saved to favorites" });
  } catch (error) {
    console.error("Error saving favorite location:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

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

    console.log("Populated favorites:", user.favorites);

    res.status(200).json(user.favorites);
  } catch (error) {
    console.error("Error fetching favorite locations:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
