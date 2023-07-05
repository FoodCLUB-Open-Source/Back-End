/* This file contains the rate limiter that will be used throughout the app */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require("../redisConfig")

/* 
This is the middleware that will be implemented in the following manner:
app.use('/api/fast', createRateLimiter(200, 15), (req, res) => {
*/

function rateLimiter(maxRequests, windowInMinutes) {
    return rateLimit({
        store: new RedisStore({
			sendCommand: (...args) => Redis.sendCommand(args),
		}),
        windowMs: windowInMinutes || 15 * 60 * 1000,
        max: maxRequests || 100,
        delayMs: 0,
        handler: function (req, res, next) {
            res.status(429).send('Too many requests, please try again later.');
        },
    });
}

module.exports = rateLimiter;
