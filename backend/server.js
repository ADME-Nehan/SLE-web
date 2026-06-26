const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

app.use('/api/sources', require('./routes/sources'));
app.use('/api/news', require('./routes/news'));
app.use('/api/admin', require('./routes/admin'));

// Start scheduler (every 2 hours)
require('./services/scheduler');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
