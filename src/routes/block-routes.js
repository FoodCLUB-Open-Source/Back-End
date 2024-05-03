import { Router } from "express";
import inputValidator from "../middleware/input_validator.js";
import rateLimiter from "../middleware/rate_limiter.js";
import pgPool from "../config/pgdb.js";
import { verifyAccessOnly, verifyTokens } from "../middleware/verify.js";

const router = Router();

/**
 * Retrieve Blocked Users for Authenticated User
 * This endpoint retrieves the list of users blocked by the authenticated user.
 * This endpoint needs a request header called 'Authorisation' with both the access token and the ID token
 *
 * @route GET /posts/block/
 * @returns {object} Returns JSON object containing an array of blocked users
 * @throws {Error} If there are errors while fetching blocked users
 */
router.get("/posts/block/", rateLimiter(), verifyTokens, async (req, res, next) => {
  try {
    // Get the authenticated user's ID from the request
    const user_id = req.body.payload.user_id;

    const psqlClient = await pgPool.connect(); // Connect to the database
    // Query to retrieve blocked users for the authenticated user
    const queryBlockedUsers =
      "SELECT * FROM blocked_users where user_id=$1";

    // Execute the query with the authenticated user's ID as a parameter
    const blockedUsersResult = await psqlClient.query(queryBlockedUsers, [user_id]);
    // Check if any blocked users were found
    if (blockedUsersResult.rows.length === 0) {
    // If no blocked users found, return appropriate message
      return res.status(404).json({ message: "No blocked users found" });
    }
    // Release the database connection
    psqlClient.release();

    // Send the blocked users data as response
    res.status(200).json({ blockedUsers: blockedUsersResult.rows });
  } catch (err) {
    // If an error occurs, log the error and pass it to the error handling middleware
    console.error("Failed to fetch blocked users:", err);
    next(err);
  }
});


/**
 * Posting Block For Specific User
 * This endpoint needs a request header called 'Authorisation' with both the access token and the ID token.
 *
 * @route POST  /posts/block/
 * @body {string} req.body.user_id - The ID of the user getting blocked
 * @returns {status} - Returns 200 for successful block, 400 if user is already blocked
 * @throws {Error} - If there are errors, the comment posting failed
 */
router.post("/posts/block/", rateLimiter(), verifyTokens, inputValidator, async (req, res, next) => {
  try {

    const psqlClient = await pgPool.connect(); // connects to database
    const blocking_user_id = parseInt(req.body.payload.user_id); // converts data from req.body.payload to int
    const blocked_user_id = parseInt(req.body.user_id); // converts data from req.body to int

    // Check if a block already exists for this user and the blocked user
    const queryExists =
      "SELECT * FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2";
    const blockExists = await psqlClient.query(queryExists, [
      blocking_user_id,
      blocked_user_id,
    ]);

    if (blockExists.rows && blockExists.rows.length !== 0) {

      return res.status(400).json({ Status: "User is already blocked." });
    }

    //query for insert block
    const postQuery =
      "INSERT INTO blocked_users(user_id, blocked_user_id) VALUES($1, $2)";

    // state query
    await psqlClient.query(postQuery, [blocking_user_id, blocked_user_id]);
    console.log("Query executed successfully");

    psqlClient.release(); // release connection

    return res.status(200).json({ Status: "Block Posted" });
  } catch (err) {
    console.error("Posting Block Failed:", err);
    next(err);
  }
}
);

/**
 * Delete Block For Specific User
 * This endpoint needs a request header called 'Authorisation' with both the access token and the ID token
 *
 * @route POST  /posts/block/
 * @body {string} req.body.user_id - The ID of the user getting unblocked
 * @returns {status} - Returns a status of comment if posted successfully
 * @throws {Error} - If there are errors, the user could not be located (404)
 */
router.delete("/posts/block/", rateLimiter(), verifyTokens, inputValidator, async (req, res, next) => {
  try {
    console.log(`Expected URL:, ${req.originalUrl}`);

    const psqlClient = await pgPool.connect(); // connects to database
    const unblocking_user_id = parseInt(req.body.payload.user_id); // converts data from req.body.payload to float
    const unblocked_user_id = parseInt(req.body.user_id); // converts data from req.body to float

    console.log(
      `Inserting blocked_users with blocking_user_id: ${unblocking_user_id}`
    );

    console.log(
      `Inserting blocked_users with blocked_user_id: ${unblocked_user_id}`
    );
    const deleteQuery =
      "DELETE FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2";
    // state query

    const result = await psqlClient.query(deleteQuery, [
      unblocking_user_id,
      unblocked_user_id,
    ]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Failed to locate user in blocked list" });
    }

    psqlClient.release(); // release connection

    return res.status(200).json({ Status: "Block Deleted" });
  } catch (err) {
    console.error("Deleting Block Failed:", err);
    next(err);
  }
}
);

export default router;