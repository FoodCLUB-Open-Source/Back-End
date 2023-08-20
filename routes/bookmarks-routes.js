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
router.delete("/profile/:user_id/bookmark/:post_id", rateLimiter(), inputValidator, async (req, res, next) => {
    try {
        const userID = req.params.user_id; // retrieving user ID
        const postID = req.params.post_id; // retrieving post ID

        const query = 'DELETE FROM bookmarks WHERE user_id = $1 AND post_id = $2'; // query to remove post from bookmarks
        const postgresQuery = await pgQuery(query, userID, postID);

        if (postgresQuery.rowCount === 1) { // if statement to check if removal was successful
            res.status(200).json({ message: 'Post is no longer bookmarked' }); // if true success response code is sent
        } else {
            res.status(400).json({message: postgresQuery.error}); // else unsuccessful response code is sent along with error message
        }
    } catch (error) {
        next(error) // server side error
    }
});

/**
 * Bookmarks a post
 * 
 * @route POST /post/:user_id/bookmark/:post_id
 * @param {string} req.params.user_id - The ID of the user
 * @param {string} req.params.post_id - The ID of the post to bookmark
 * @returns {status} - A status indicating successful bookmark of post
 * @throws {Error} - If there are errors bookmarking post
 */
router.post("/post/:user_id/bookmark/:post_id", rateLimiter(), inputValidator, async (req, res, next) => {
    try {
        const userID = req.params.user_id; // retrieving user ID
        const postID = req.params.post_id; // retrieving post ID

        const query = 'INSERT INTO bookmarks (user_id, post_id, created_at) VALUES ($1, $2, NOW())'; // query to add a post to bookmarks
        const postgresQuery = await pgQuery(query, userID, postID);

        if (postgresQuery.rowCount === 1) { // if statement to check if was added
            res.status(200).json({ message: 'Post bookmarked' }); // if true success response code is sent
        } else {
            res.status(400).json({message: postgresQuery.error}); // else unsuccessful response code is sent along with error message
        }
    } catch (error) {
        next(error) // server side error
    }
});

export default router;