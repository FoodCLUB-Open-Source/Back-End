import { Router } from "express";
import rateLimiter from "../middleware/rate_limiter.js";
import { makeTransactions, pgQuery, s3Retrieve } from "../functions/general_functions.js";
import inputValidator from "../middleware/input_validator.js";

const router = Router();

/**
 * Retrieves users that are followed by the user
 * 
 * @route GET /profile/:user_id/following
 * @param {string} req.params.user_id - The ID of the user to retrieve users that are followed by the user
 * @param {string} req.query.pageNumber - The pageNumber for pagination
 * @param {string} req.query.pageSize - The pageSize for pagination
 * @returns {Object} - An object containing details of the users that are followed by the user such as id, username and profile picture
 * @throws {Error} - If there is error retrieving user details or validation issues
 */
router.get("/profile/:user_id/following", rateLimiter(), inputValidator, async (req, res) => {
    try {
        const userID = req.params.user_id; // getting userID
        const { pageNumber, pageSize } = req.query; // getting page number and page size

        const query = 'SELECT following.user_following_id, users.username, users.profile_picture FROM following JOIN users on following.user_following_id = users.id WHERE following.user_id = $1 ORDER BY following.created_at ASC LIMIT $3 OFFSET (($2 - 1) * $3)'; // returns the users that are followed by the user with pagination
        const userFollowing = await pgQuery(query, userID, pageNumber, pageSize);

        return res.status(200).json({ data: userFollowing.rows }); // sends details to client
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: error.message }); // server side error
    }
});

/*Following A User*/
router.post("/follow/user/:user_id/following/:user_following_id", rateLimiter(), inputValidator, async (req, res, next) => {
    try {
        // Extract user IDs from request parameter
        const {user_id, user_following_id} = req.params;
        
        const verifyUserExistenceQuery = pgQuery(`SELECT * FROM users WHERE id = $1`, user_id);
        const verifyFollowingUserExistenceQuery = pgQuery(`SELECT * FROM users WHERE id = $1`, user_following_id);
        const checkFollowQuery = pgQuery(`SELECT * FROM following WHERE user_id = $1 AND user_following_id = $2`, user_id, user_following_id);
      
        const [verifyUserExistence, verifyFollowingUserExistence, checkFollow] = await Promise.all([
          verifyUserExistenceQuery,
          verifyFollowingUserExistenceQuery,
          checkFollowQuery
        ]);
          
        // Verify the existence of the user based on their ID
        if (verifyUserExistence.rows.length === 0) {
           return res.status(400).json({ "error": "User not found" });
        }
        
        // Verify the existence of the user being followed based on their ID
        if (verifyFollowingUserExistence.rows.length === 0) {
           return res.status(400).json({ "error": "Following user not found" });
        }
        
        // Check if the user is already following the target user     
        if (checkFollow.rows.length !== 0) {
           return res.status(400).json({ "error": "Already following user" });
        }
        
        // Insert a new following relationship into the database
        const query = [
        `INSERT INTO following (user_id, user_following_id, created_at) VALUES ($1, $2, NOW()) RETURNING *`
        ];
        const values = [[user_id, user_following_id]];
        
        //helper function of database transactions
        const result = await makeTransactions(query, values);
  
        if (result.length === 0) {
           return res.status(400).json({ "error": "Follow not created" });
        }
  
        // Respond with success message
        return res.status(200).json({ "success": "Follow created" });
  
    } catch (err) {
       // Handle errors
       next(err);
    }
  });
  

export default router;