require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const postRoutes = require('./routes/posts');


const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));


app.use('/api/posts', postRoutes);


const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => app.listen(PORT, () => console.log('Server running on', PORT)))
.catch(err => console.error(err));