/* Establishing connection to the mongoDB datbase */

const mongoose = require('mongoose');
require('dotenv').config();

const mongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      useCreateIndex: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
};

module.exports = mongoDB;