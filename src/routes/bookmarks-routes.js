import { Router } from "express";
import rateLimiter from "../middleware/rate_limiter.js";
import inputValidator from "../middleware/input_validator.js";
import { checkLike, checkView, pgQuery, updatePosts } from "../functions/general_functions.js";
import { verifyTokens } from "../middleware/verify.js";

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
router.delete("/profile/bookmark/:post_id", rateLimiter(), verifyTokens, inputValidator, async (req, res, next) => {
    try {
        const { post_id } = req.params; // retrieving userID and postID
        const { payload } = req.body
        const user_id = payload.user_id

        const query = 'DELETE FROM bookmarks WHERE user_id = $1 AND post_id = $2'; // query to remove post from bookmarks
        const postgresQuery = await pgQuery(query, user_id, post_id);

        if (postgresQuery.rowCount === 1) { // if statement to check if removal was successful
            res.status(200).json({ message: 'Post is no longer bookmarked' }); // if true success response code is sent
        }
        else if (postgresQuery.rowCount === 0) {
            res.status(400).json({message: 'This post has already been deleted'}); 
        }
        else {
            res.status(400).json({message: postgresQuery.error}); // else unsuccessful response code is sent along with error message
        }
    } catch (error) {
        next(error); // server side error
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
router.post("/post/bookmark/:post_id", rateLimiter(), verifyTokens, inputValidator, async (req, res, next) => {
    try {
        const { post_id } = req.params; // retrieving userID and postID
        const { payload } = req.body
        const user_id = payload.user_id

        const query = 'INSERT INTO bookmarks (user_id, post_id, created_at) VALUES ($1, $2, NOW())'; // query to add a post to bookmarks
        const postgresQuery = await pgQuery(query, user_id, post_id);

        if (postgresQuery.rowCount === 1) { // if statement to check if was added
            res.status(200).json({ message: 'Post bookmarked' }); // if true success response code is sent
        } else {
            res.status(400).json({message: postgresQuery.error}); // else unsuccessful response code is sent along with error message
        }
    } catch (error) {
        next(error); // server side error
    }
});

/**
 * Gets posts which have been bookmarked of a user
 * 
 * @route GET /profile/:user_id/bookmark/
 * @param {string} req.params.user_id - The ID of the user
 * @returns {Array} - An array of objects containing details of the post the user has bookmarked 
 * @throws {Error} - If there are errors fetching bookmarked posts
 */
router.get("/:user_id", rateLimiter(), inputValidator, async(req, res, next) => {
    try {
        const { user_id } = req.params; // retrieving userID
        const { page_number, page_size } = req.query; // getting page number and page size

        // const bookmarkPostsQuery = "SELECT p.id, p.title, p.description, p.video_name, p.thumbnail_name, p.created_at FROM posts p JOIN bookmarks b ON p.id = b.post_id WHERE b.user_id = $1 ORDER BY b.created_at DESC LIMIT $3 OFFSET (($2 - 1) * $3)"; // query to get bookmarked post details
        const bookmarkPostsQuery = `
        SELECT 
            p.id, p.title, p.description, p.video_name, p.thumbnail_name, p.created_at, u.id AS user_id, u.full_name, u.profile_picture, u.username, pc.name as post_category,
            CASE 
                WHEN fol.user_following_id IS NOT NULL THEN true 
                ELSE false 
            END as isFollowed
        FROM 
            posts p 
        JOIN 
            bookmarks b ON p.id = b.post_id 
        JOIN 
            users u ON p.user_id = u.id
        JOIN
            posts_categories pc ON pc.post_id = p.id
        LEFT JOIN
            following fol ON u.id = fol.user_following_id AND fol.user_id = $1
        WHERE 
            b.user_id = $1 
        ORDER BY 
            b.created_at DESC 
        LIMIT $3 
        OFFSET (($2 - 1) * $3)`; // query to get bookmarked post details

        const bookmarkPostsQueryPromise = await pgQuery(bookmarkPostsQuery, user_id, page_number, page_size);
        const updatedPostsData = await updatePosts(bookmarkPostsQueryPromise.rows,parseInt(user_id)); // updating post objects to include further information

        return res.status(200).json({ data: updatedPostsData }); // sending data to client (if array is empty it means user has no posts bookmarked or posts information does not exist in database)
    } catch (error) {
        next(error); // server side error
    }
});

export default router;
