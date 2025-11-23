import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai"; // npm install @google/generative-ai
import nodemailer from "nodemailer"; // 28/10/25 Imported for Email Verif
import jwt from "jsonwebtoken"; // 28/10/25 Imported for Email Verif

// .env variables
dotenv.config();
console.log("JWT_SECRET loaded:", process.env.JWT_SECRET ? "Yes" : "No");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// middleware
app.use(express.json());
app.use(cors());

// serves static files from 'Website' folder
const websitePath = path.join(__dirname, "Website");
console.log("Serving static files from:", websitePath);
app.use(express.static(websitePath));

// serve index.html at root "/"
app.get("/", (req, res) => {
  const indexPath = path.join(websitePath, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("Error serving index.html:", err);
      res.status(404).send("<h1>404 - index.html not found</h1><p>Check Website/index.html.</p>");
    }
  });
});

// MongoDB connection
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("❌ MONGO_URI not set in .env. Please create a .env file.");
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// user schema
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, unique: true },
    passwordHash: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    points: { type: Number, default: 0, min: 0 },
    completedChallenges: [{ 
      challengeId: { type: Number, required: true }, 
      completedAt: { type: Date, default: Date.now }
    }]
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);

// forum post schema NOT IMPLEMENTED YET
const forumPostSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    threadId: { type: String, required: true },
    parentId: { type: String },
    title: { type: String },
    body: { type: String, required: true },
    likes: { type: Number, default: 0 }
  },
  { timestamps: true }
);
const ForumPost = mongoose.model("ForumPost", forumPostSchema);

// Email transporter setup (using Nodemailer)
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// register endpoint
app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser = new User({ username, email, passwordHash });
    await newUser.save();
    res.status(201).json({
      message: "User registered successfully!",
      user: { id: newUser._id, username, email },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// login endpoint
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    res.json({
      message: "Login successful!",
      user: { id: user._id, username: user.username, email },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// API status
app.get("/api", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// BELOW ARE NEW points and progress endpoints
app.get("/api/user/:userId/points", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('points completedChallenges');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ 
      points: user.points, 
      completed: user.completedChallenges.map(c => c.challengeId),
      totalCompleted: user.completedChallenges.length 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/user/:userId/complete-challenge", async (req, res) => {
  try {
    const { challengeId, pointsEarned = 100 } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.completedChallenges.some(c => c.challengeId === challengeId)) {
      return res.status(400).json({ message: "Challenge already completed" });
    }
    user.completedChallenges.push({ challengeId });
    user.points += pointsEarned;
    await user.save();
    res.json({ 
      message: "Challenge completed!", 
      newPoints: user.points,
      totalCompleted: user.completedChallenges.length 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/user/:userId/points", async (req, res) => {
  try {
    const { points } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { points: Math.max(0, points) },
      { new: true }
    ).select('points');
    res.json({ points: user.points });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// leaderboard
app.get("/api/leaderboard", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const users = await User.find()
      .select('username points')
      .sort({ points: -1 })
      .limit(limit)
      .lean();
    res.json(users.map((u, idx) => ({
      rank: idx + 1,
      username: u.username,
      points: u.points
    })));
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Change password (for logged-in user)
app.post("/api/user/:userId/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash new password and update
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);
    user.passwordHash = newPasswordHash;
    await user.save();

    res.json({ message: "Password changed successfully!" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Send email verification (for logged-in user)
app.post("/api/user/:userId/send-verification-email", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Generate a JWT token (expires in 24 hours)
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    const verificationLink = `${process.env.FRONTEND_URL}/profile.html?token=${token}`;

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Verify Your Email',
      html: `<p>Click <a href="${verificationLink}">here</a> to verify your email. This link expires in 24 hours.</p>`
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "Verification email sent! Check your inbox." });
  } catch (error) {
    console.error("Send verification email error:", error);
    res.status(500).json({ message: "Failed to send email. Please try again." });
  }
});

// Verify email via token (GET for link clicks)
// Verify email via token (GET for link clicks)
app.get("/api/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    console.log("Received token:", token);
    if (!token) return res.status(400).json({ success: false, message: "Invalid token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded);
    const user = await User.findById(decoded.userId);
    console.log("User found:", user ? user.email : "No user");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.emailVerified) {
      return res.json({ success: true, message: "Email already verified!" });
    }

    user.emailVerified = true;
    await user.save();
    console.log("User saved, emailVerified:", user.emailVerified);
    res.json({ success: true, message: "Email verified successfully!" });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(400).json({ success: false, message: "Invalid or expired token" });
  }
});

app.get("/api/user/:userId/status", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('emailVerified');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ emailVerified: user.emailVerified });
  } catch (error) {
    console.error("Get status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// forum endpoints
app.get("/api/forums/:threadId", async (req, res) => {
  try {
    const posts = await ForumPost.find({ threadId: req.params.threadId, parentId: null })
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .lean();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/forums/:threadId", async (req, res) => {
  try {
    const { userId, body, parentId, title } = req.body;
    if (!userId || !body) return res.status(400).json({ message: "Missing required fields" });
    const post = new ForumPost({
      userId,
      threadId: req.params.threadId,
      parentId: parentId || null,
      title: title || null,
      body
    });
    await post.save();
    const populated = await ForumPost.findById(post._id).populate('userId', 'username');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// AI prompt endpoint
app.post("/api/generate-prompt", async (req, res) => {
  try {
    const { prompt, history = [] } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ message: "Invalid prompt" });
    }
    const contents = history.concat([{ role: "user", parts: [{ text: prompt }] }]);
    const result = await model.generateContent({ contents });
    res.json({ response: result.response.text() });
  } catch (error) {
    console.error("Gemini error:", error);  // keep this for debugging pls
    res.status(500).json({ message: "AI service error", details: error.message }); 
  }
});

// BUG FIX: Moved the catch-all middleware to the END of the file, after all API routes. This prevents it from intercepting API requests (e.g., /api/leaderboard) and ensures they reach their handlers instead of serving index.html.
// catch-all for SPA (only for GET requests)
app.use((req, res, next) => {
  if (req.method === "GET") {
    const indexPath = path.join(websitePath, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error("Error serving index.html (catch-all):", err);
        res.status(404).send("<h1>404 - Page Not Found</h1>");
      }
    });
  } else {
    next();
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
