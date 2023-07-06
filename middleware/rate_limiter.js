/* This file contains the rate limiter that will be used throughout the app */

const Redis = require("../redisConfig");

/* 
Uses the client's IP address to track the number of requests.
Sliding window time frame.
This is the middleware that will be implemented in the following manner:
app.use('/api/fast', createRateLimiter(200, 15), (req, res) => {
*/

function rateLimiter(maxRequests, windowInMinutes) {
    return async function(req, res, next) {
        try {
            const now = Date.now();
            const windowStart = now - windowInMinutes * 60 * 1000;
            const IP = req.ip;

            // Fetch timestamps of requests from Redis within the timeframe
            const timestamps = await Redis.zrangebyscore(IP, windowStart, now);

            if (timestamps.length >= (maxRequests || 100)) {
                res.status(429).send('Too many requests, please try again later.');
            } else {
                // Add current request timestamp to Redis and set expiry
                await Redis.zadd(IP, now, now);
                await Redis.expire(IP, (windowInMinutes || 15) * 60);
                next();
            }
        } catch (error) {
            console.error(error);
            res.status(500).send('An error occurred.');
        }
    };
};

module.exports = rateLimiter;
