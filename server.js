const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aios-v2', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('🚀 MongoDB Connected successfully'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'AIOS V2 is running' });
});

app.get('/api/metrics', (req, res) => {
  res.json({
    cpu: process.cpuUsage(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});