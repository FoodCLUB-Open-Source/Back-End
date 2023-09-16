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
        const userStoryMap = {}; // object to organize stories by user

        // Use Promise.all to wait for all queries to complete
        Promise.all(
            userFollowing.rows.map(async (user) => {
                try {
                    const stories = await getDynamoRequestBuilder("Stories").query("user_id", parseInt(user.user_following_id)).useIndex("user_id-created_at-index").scanIndexDescending().exec(); // querying dynamoDB to get user stories
                    if (stories.length !== 0) { // checking if user has uploaded a story
                        if (!userStoryMap[user.user_following_id]) { // checking if userStoryMap contains user details
                            // if not user details are created and stored
                            userStoryMap[user.user_following_id] = {
                                user_id: user.user_following_id,
                                profile_picture: user.profile_picture,
                                username: user.username,
                                stories: [],
                            };
                        }
                        stories.forEach((story) => { // processing all user stories
                            // retrieving URLs and replacing them
                            const videoURL = s3Retrieve(story.video_url);
                            const thumbnailURL = s3Retrieve(story.thumbnail_url);
                            story.video_url = videoURL;
                            story.thumbnail_url = thumbnailURL;

                            // pushing stories data to stories array
                            userStoryMap[user.user_following_id].stories.push({
                                story_id: story.story_id,
                                thumbnail_url: story.thumbnail_url,
                                video_url: story.video_url,
                            });
                        });
                    }
                } catch (error) {
                    console.error(error);
                    return res.status(400).json({ error: error });
                }
            })
        ).then(() => {
            // converting the userStoryMap object to an array
            const userStoriesArray = Object.values(userStoryMap);
            // sending data to client
            return res.status(200).json({ stories: userStoriesArray});
        }).catch((error) => {
            console.error(error);
            return res.status(400).json({ error: error });
        });
    } catch (error) {
        next(error) // server side error
    }
});

export default router;