/* This file contains the rate limiter that will be used throughout the app */

const Redis = require("../redisConfig");


/* 
Uses the client's IP address to track the number of requests.
Sliding window time frame.
This is the middleware that will be implemented in the following manner:
app.use('/api/fast', rateLimiter(200, 15), (req, res) => {
or alternatively
you can just use rateLimiter() to use the default values that are specified in the .env file
*/

const rateLimiter = (maxRequests, windowInMins) => {    
    return async (req, res, next) => {
        try{
            
            const requests = maxRequests || process.env.RATE_LIMITER_MAX_REQUESTS;
            const window = windowInMins || process.env.RATE_LIMITER_WINDOW_REFRESH_MINS;
            
            const IP = req.ip;
            const endpoint = req.path.replace(/\/\d+/, '/id'); // Replace dynamic parts with a wildcard
            const redisKey = `RATE_LIMITER|${IP}|${endpoint+ "|" + req.method.toUpperCase()}`;

            const now = Date.now();
            const nowWindow = now + (window * 60000);
            
            //Get timestamps inbetween now and the expirey date.
            const timestamps = await Redis.zRangeByScore(redisKey, now, nowWindow);
            
            if (timestamps.length >= requests) {
                res.status(429).send('You have exceeded the maximum amount of requests. Please try again later');
            } else {
                //Log the request and add the expiration to the set and set a expiry date
                await Redis.ZADD(redisKey, {
                    score: nowWindow,
                    value: nowWindow.toString()
                });
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
