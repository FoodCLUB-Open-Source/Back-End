/* This file contains the rate limiter that will be used throughout the app */

const Redis = require("../redisConfig");

/* 
    This is the middleware that will be implemented in the following manner:
    app.use('/api/fast', rateLimiter(200, 15), (req, res) => {

    or alternatively:

    you can just use rateLimiter() to use the default values that are specified in the .env file
*/

const rateLimiter = (maxRequests, windowInMins) => {    
    return async (req, res, next) => {
        try{
            
            const requests = maxRequests || process.env.RATE_LIMITER_MAX_REQUESTS;
            const window = windowInMins || process.env.RATE_LIMITER_WINDOW_REFRESH_MINS;
            
            const IP = req.ip;
            const endpoint = `${req.method}:${req.route.path}`;
            const redisKey = `RATE_LIMITER|${IP}|${endpoint}`;

            const now = Date.now();
            const nowWindow = now + (window * 60000);

            //Get timestamps inbetween now and the expirey date.
            const timestamps = await Redis.zRangeByScore(redisKey, now, nowWindow);
            
            if (timestamps.length >= requests) {
                res.set({
                    'X-RateLimit-Limit': requests, //Maximum number of requests allowed
                    'X-RateLimit-Remaining': Math.max(0, requests - timestamps.length - 1), // Requests left in Window
                    'X-RateLimit-Reset': nowWindow // Tme when teh rate limit will reset
                }).status(429).send({
                    status: 'error',
                    message: `Rate limit exceeded limit. Try again later in ${window} minutes.`
                });            
            } else {
                //Log the request and add the expiration to the set and set a expiry date

                await Redis.multi()
                    .ZADD(redisKey, {
                        score: nowWindow,
                        value: nowWindow.toString()
                    })
                    .expire(redisKey, window * 60)
                    .exec();

                next();
            };
        } catch (err) {
            next(err);
        };
    };
};

module.exports = rateLimiter;
