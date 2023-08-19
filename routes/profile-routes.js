import { Router } from "express";
import rateLimiter from "../middleware/rate_limiter.js";
import { pgQuery, s3Retrieve } from "../functions/general_functions.js";
import inputValidator from "../middleware/input_validator.js";

const router = Router();

/**
 * Retrieves users that are followed by the user
 * 
 * @route GET /:user_id/following
 * @param {string} req.params.user_id - The ID of the user to retrieve users that are followed by the user
 * @param {string} req.query.page_number - The pageNumber for pagination
 * @param {string} req.query.page_size - The pageSize for pagination
 * @returns {Object} - An object containing details of the users that are followed by the user such as id, username and profile picture
 * @throws {Error} - If there is error retrieving user details or validation issues
 */
router.get("/:user_id/following", rateLimiter(), inputValidator, async (req, res, next) => {
    try {
        const userID = req.params.user_id; // getting userID
        const { page_number, page_size } = req.query; // getting page number and page size

        const query = 'SELECT following.user_following_id, users.username, users.profile_picture FROM following JOIN users on following.user_following_id = users.id WHERE following.user_id = $1 ORDER BY following.created_at ASC LIMIT $3 OFFSET (($2 - 1) * $3)'; // returns the users that are followed by the user with pagination
        const userFollowing = await pgQuery(query, userID, page_number, page_size);

        return res.status(200).json({ data: userFollowing.rows }); // sends details to client
    } catch (error) {
        next(error) // server side error
    }
});

/**
 * Retrieves users that follow the user
 * 
 * @route GET /:userid/followers
 * @param {string} req.params.user_id - The ID of the user to retrieve users that follow the user
 * @param {string} req.query.page_number - The pageNumber for pagination
 * @param {string} req.query.page_size - The pageSize for pagination
 * @returns {Object} - An object containing details of the users that follow the user such as id, username and profile picture
 * @throws {Error} - If there is error retrieving user details or validation issues
 */
router.get("/:user_id/followers", rateLimiter(), inputValidator, async (req, res, next) => {
    try {
        const userID = req.params.user_id; // getting userID
        const { page_number, page_size } = req.query; // getting page number and page size

        const query = 'SELECT following.user_id, users.username, users.profile_picture FROM following JOIN users on following.user_id = users.id WHERE following.user_following_id = $1 ORDER BY following.created_at ASC LIMIT $3 OFFSET (($2 - 1) * $3)'; // returns the users that follow the user with pagination
        const userFollowers = await pgQuery(query, userID, page_number, page_size);

        return res.status(200).json({ data: userFollowers.rows }); // sends details to client
    } catch (error) {
        next(error) // server side error
    }
});

export default router;