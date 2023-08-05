
const { createClient } = require('redis');

const Redis = createClient({
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});

Redis.connect()
.then(() => console.log('Successfully connected to Redis'))
.catch(err => console.error('Could not connect to Redis:', err));

module.exports = Redis