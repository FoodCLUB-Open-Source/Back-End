import { Router } from "express";
import rateLimiter from "../middleware/rate_limiter.js";
import { pgQuery, s3Retrieve } from "../functions/general_functions.js";

const router = Router();

/**
 * Retrieves users that are followed by the user
 * 
 * @route GET /profile/:userid/following
 * @param {string} req.params.userid - The ID of the user to retrieve users that are followed by the user
 * @param {string} req.query.pageNumber - The pageNumber for pagination
 * @param {string} req.query.pageSize - The pageSize for pagination
 * @returns {Object} - An object containing details of the users that are followed by the user such as id, username and profile picture
 * @throws {Error} - If there is error retrieving user details or validation issues
 */
router.get("/profile/:userid/following", rateLimiter(), async (req, res) => {
    try {
        const userID = req.params.userid; // getting userID and converting to integer
        const { pageNumber, pageSize } = req.query; // getting page number and page size

        const query = 'SELECT following.user_following_id, users.username, users.profile_picture FROM following JOIN users on following.user_following_id = users.id WHERE following.user_id = $1 ORDER BY following.created_at ASC LIMIT $3 OFFSET (($2 - 1) * $3)'; // returns the users that are followed by the user with pagination
        const userFollowing = await pgQuery(query, userID, pageNumber, pageSize);

        return res.status(200).json({ data: userFollowing.rows }); // sends details to client
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: error.message }); // server side error
    }
});

export default router;