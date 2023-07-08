/* This file contains the rate limiter that will be used throughout the app */

const Redis = require("../redisConfig");


/* 
Uses the client's IP address to track the number of requests.
Sliding window time frame.
This is the middleware that will be implemented in the following manner:
app.use('/api/fast', createRateLimiter(200, 15), (req, res) => {
*/

const rateLimiter = (maxRequests, windowInMins) => {    
    return async (req, res, next) => {
        try{

            const requests = maxRequests || process.env.RATE_LIMITER_MAX_REQUESTS;
            const window = windowInMins || process.env.RATE_LIMITER_WINDOW_REFRESH_MINS;
            const IP = req.ip;
            const redisKey = `RATE_LIMITER:${IP}`;
            const now = Date.now();
            
            const timestamps = await Redis.zRange(redisKey, 0, -1, {
                by: 'SCORE'
            });
            
            if (timestamps.length >= requests) {
                res.status(429).send('You have exceeded the maximum amount of requests. Please try again later');
            } else {
                await Redis.ZADD(redisKey, {
                    score: now,
                    value: now.toString()
                })
                await Redis.expire(redisKey, window * 60);
                next();
            }
        } catch (error) {
            console.error(error);
            res.status(500).send('An error occurred.');
        };
    };
};

module.exports = rateLimiter;
