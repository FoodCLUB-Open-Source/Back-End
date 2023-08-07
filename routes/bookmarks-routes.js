import { Router } from "express";
import rateLimiter from "../middleware/rate_limiter.js";
import inputValidator from "../middleware/input_validator.js";
import { pgQuery } from "../functions/general_functions.js";

const router = Router();

/**
 * Removes a post that has been bookmarked by a user
 * 
 * @route DELETE /profile/:userid/bookmark/:postid
 * @param {string} req.params.user_id - The ID of the user
 * @param {string} req.params.post_id - The ID of the post to unbookmark
 * @returns {status} - A status indicating successful removal of post from bookmarks
 * @throws {Error} - If there are error removing post
 */
router.delete("/profile/:user_id/bookmark/:post_id", rateLimiter(), inputValidator, async (req, res) => {
    try {
        const userID = req.params.user_id; // retrieving user ID
        const postID = req.params.post_id; // retrieving post ID

        const query = 'DELETE FROM bookmarks WHERE user_id = $1 AND post_id = $2'; // query to remove post from bookmarks
        const postgresQuery = await pgQuery(query, userID, postID);

        if (postgresQuery.rowCount === 1) { // if statement to check if removal was successful
            res.status(200).json({ message: 'Post is no longer bookmarked' }); // if true success response code is sent
        } else {
            res.status(418).json({ message: 'Removal unsuccessful' }); // else unsuccessful response code is sent along with error message
        }
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message }); // server side error
    }
});

export default router;