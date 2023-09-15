import { Router } from "express";

import inputValidator from "../middleware/input_validator.js";
import rateLimiter from "../middleware/rate_limiter.js";

import { pgQuery, s3Retrieve } from "../functions/general_functions.js";
import getDynamoRequestBuilder from "../config/dynamoDB.js";

const router = Router();

/**
 * Retrieves stories of users that are followed by the user 
 * 
 * @route GET /:userid
 * @param {string} req.params.user_id - The ID of the user to retrieve stories for
 * @query {string} req.query.page_number - The page number for pagination.
 * @query {string} req.query.page_size - The page size for pagination.
 * @returns {Object} - An object containing story information such as story id, video URL, thumbnail URL, view count, created at
 * @throws {Error} - If there is error retrieving stories
 */
router.get("/:user_id", rateLimiter(), inputValidator, async (req, res, next) => {
    try {
        const userID = req.params.user_id; // retrieving userID
        const { page_number, page_size } = req.query; // getting page number and page size

        // getting users the user follows
        const query = 'SELECT following.user_following_id, users.username, users.profile_picture FROM following JOIN users on following.user_following_id = users.id WHERE following.user_id = $1 ORDER BY following.created_at ASC'; // returns the users that are followed by the user with pagination
        const userFollowing = await pgQuery(query, userID); // executing query
        const userStories = []; // array to store user stories
        const storyPromises = userFollowing.rows.map(async (user) => { // map function to query dynamoDB to get user stories
            try {
                const story = await getDynamoRequestBuilder("Stories").query("user_id", parseInt(user.user_following_id)).useIndex("user_id-created_at-index").scanIndexDescending().exec(); // executing query to get user stories
                if (story.length != 0) { // if length is not equal to 0 this means user has posted story
                    userStories.push(story[0]); // story appended to user stories
                }
            } catch (error) {
                return res.status(400).json({ error: error }); // error
            }
        });

        // Use Promise.all to wait for all Promises to resolve
        Promise.all(storyPromises)
            .then(() => {
                return res.status(200).json({ stories: userStories }); // sending data to client
            })
            .catch((error) => {
                return res.status(400).json({ error: error }); // error
            });

    } catch (error) {
        next(error) // server side error
    }
});

export default router;