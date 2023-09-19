import pgPool from "../config/pgdb.js";
import { pgQuery } from "../functions/general_functions.js";

// Check if a Redis key exists
export async function redisUserExists(redisClient, id) {
    try {
        const hashKey = `USER|${id}`;
        const response = await redisClient.HGETALL(hashKey);
        const result = Object.keys(response);

        if (result.length > 0) {
            return response;
        } else {
            return false;
        }
    } catch (error) {
        console.error("An error occurred while querying Redis:", error);
        throw error; // Rethrow the error to handle it at a higher level if needed.
    }
}

// Add a new user to Redis
export async function redisNewUser(redisClient, id) {
    try {
        const post = await pgQuery(`SELECT * FROM users WHERE id = $1`, id);
        const userData = post.rows[0];

        if (userData) {
            const hashKey = `USER|${id}`;
            const fieldValues = {
                username: userData.username,
                profilePic: userData.profile_picture,
                user_posts: '[]'
            };

            // Use hmset to set multiple fields in Redis
            const result = await redisClient.HSET(hashKey, fieldValues);

            if (result === 'OK') {
                console.log("New key in Redis has been set");
            }
        } else {
            console.log("User does not exist");
        }
    } catch (error) {
        console.error("An error occurred while adding a new user to Redis:", error);
        throw error; // Rethrow the error to handle it at a higher level if needed.
    }
}
