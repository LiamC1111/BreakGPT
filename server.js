import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import nodemailer from "nodemailer"; 
import jwt from "jsonwebtoken"; 

// 1. LOAD ENV VARIABLES
dotenv.config();

// 2. DEBUG LOGGING (Last 5 characters)
console.log("---------------------------------------------------");
const keyCheck = process.env.GEMINI_API_KEY || "";
const keyLength = keyCheck.length;
const lastFive = keyLength > 5 ? keyCheck.slice(-5) : "TOO_SHORT";

console.log("🔍 CHECKING KEY ENDING:", lastFive);
console.log("---------------------------------------------------");

// 3. INITIALIZE GEMINI (With error handling)
let model;
try {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // NOTE: Try changing this to "gemini-1.5-flash" if 2.0 continues to fail
  model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
} catch (err) {
  console.log("⚠️ Gemini initialization skipped (Key missing or invalid format)");
}

// resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// middleware
app.use(express.json());
app.use(cors());

// serves static files from 'Website' folder
const websitePath = path.join(__dirname, "Website");
app.use(express.static(websitePath));

// serve index.html at root "/"
app.get("/", (req, res) => {
  const indexPath = path.join(websitePath, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send("<h1>404 - index.html not found</h1>");
    }
  });
});

// MongoDB connection
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("❌ MONGO_URI not set in .env.");
  process.exit(1);
}

mongoose.connect(mongoUri)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// --- SCHEMAS ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, unique: true },
  passwordHash: { type: String, required: true },
  emailVerified: { type: Boolean, default: false },
  points: { type: Number, default: 0, min: 0 },
  completedChallenges: [{ 
    challengeId: { type: Number, required: true }, 
    completedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });
const User = mongoose.model("User", userSchema);

const forumPostSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  threadId: { type: String, required: true },
  parentId: { type: String },
  title: { type: String },
  body: { type: String, required: true },
  likes: { type: Number, default: 0 }
}, { timestamps: true });
const ForumPost = mongoose.model("ForumPost", forumPostSchema);

// Email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// --- AUTH ROUTES ---
app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: "Fill all fields" });
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User exists" });
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser = new User({ username, email, passwordHash });
    await newUser.save();
    
    res.status(201).json({ message: "Registered!", user: { id: newUser._id, username, email } });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
    
    res.json({ message: "Login success", user: { id: user._id, username: user.username, email } });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// --- POINTS ROUTES ---
app.get("/api/user/:userId/points", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('points completedChallenges');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ 
      points: user.points, 
      completed: user.completedChallenges.map(c => c.challengeId)
    });
  } catch (error) { res.status(500).json({ message: "Server error" }); }
});

app.post("/api/user/:userId/complete-challenge", async (req, res) => {
  try {
    const { challengeId, pointsEarned = 100 } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.completedChallenges.some(c => c.challengeId === challengeId)) {
      return res.status(400).json({ message: "Already completed" });
    }
    user.completedChallenges.push({ challengeId });
    user.points += pointsEarned;
    await user.save();
    res.json({ message: "Challenge completed!", newPoints: user.points });
  } catch (error) { res.status(500).json({ message: "Server error" }); }
});

app.put("/api/user/:userId/points", async (req, res) => {
  try {
    const { points } = req.body;
    const user = await User.findByIdAndUpdate(req.params.userId, { points: Math.max(0, points) }, { new: true });
    res.json({ points: user.points });
  } catch (error) { res.status(500).json({ message: "Server error" }); }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const users = await User.find().select('username points').sort({ points: -1 }).limit(10).lean();
    res.json(users.map((u, idx) => ({ rank: idx + 1, username: u.username, points: u.points })));
  } catch (error) { res.status(500).json({ message: "Server error" }); }
});

// --- VERIFICATION & PASSWORD ---
app.post("/api/user/:userId/change-password", async (req, res) => {
  /* ... (Existing logic kept same) ... */
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user || !await bcrypt.compare(currentPassword, user.passwordHash)) {
      return res.status(400).json({ message: "Invalid current password" });
    }
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.json({ message: "Password updated" });
  } catch (e) { res.status(500).json({ message: "Error" }); }
});

app.post("/api/user/:userId/send-verification-email", async (req, res) => {
  /* ... (Existing logic kept same) ... */
   try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/profile.html?token=${token}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER, to: user.email, subject: 'Verify Email',
      html: `<a href="${link}">Verify here</a>`
    });
    res.json({ message: "Email sent" });
  } catch (e) { res.status(500).json({ message: "Error sending email" }); }
});

app.get("/api/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    user.emailVerified = true;
    await user.save();
    res.json({ success: true, message: "Verified!" });
  } catch (e) { res.status(400).json({ success: false, message: "Invalid token" }); }
});

// --- FORUMS ---
app.get("/api/forums/:threadId", async (req, res) => {
  try {
    const posts = await ForumPost.find({ threadId: req.params.threadId }).populate('userId', 'username').sort({ createdAt: -1 });
    res.json(posts);
  } catch (e) { res.status(500).json({ message: "Error" }); }
});

app.post("/api/forums/:threadId", async (req, res) => {
  try {
    const { userId, body } = req.body;
    const post = new ForumPost({ userId, threadId: req.params.threadId, body });
    await post.save();
    const pop = await ForumPost.findById(post._id).populate('userId', 'username');
    res.status(201).json(pop);
  } catch (e) { res.status(500).json({ message: "Error" }); }
});

// --- AI GENERATION (With Kill Switch) ---
app.post("/api/generate-prompt", async (req, res) => {
  // 1. Check for Manual Kill Switch in .env
  if (process.env.ENABLE_AI === 'false') {
    return res.json({ response: "🤖 [MOCK MODE] AI is disabled. This is a fake response." });
  }

  try {
    const { prompt, history = [] } = req.body;
    
    // 2. Check if model exists (in case key failed)
    if (!model) {
      throw new Error("AI Model not initialized (Check server logs for Key issues)");
    }

    const contents = history.concat([{ role: "user", parts: [{ text: prompt }] }]);
    const result = await model.generateContent({ contents });
    res.json({ response: result.response.text() });

  } catch (error) {
    console.error("Gemini error:", error.message);
    
    // 3. Graceful Fallback if Google fails
    res.json({ 
      response: "⚠️ The AI is currently unavailable (API Error). But the system is secure." 
    });
  }
});

// Catch-all
app.use((req, res, next) => {
  if (req.method === "GET") {
    res.sendFile(path.join(websitePath, "index.html"), (err) => {
       if(err) res.status(404).send("404"); 
    });
  } else { next(); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));