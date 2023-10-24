import { Router } from "express";

import inputValidator from "../middleware/input_validator.js";
import rateLimiter from "../middleware/rate_limiter.js";
import multer, { memoryStorage } from "multer";

import { makeTransactions, pgQuery, s3Delete, s3Upload, updatePosts } from "../functions/general_functions.js";
import getDynamoRequestBuilder from "../config/dynamoDB.js";

const storage = memoryStorage();
const upload = multer({ storage: storage })
const router = Router();

/**
 * Retrieves profile page data based on the received user ID 
 * 
 * @route GET /:userid
 * @param {string} req.params.user_id - The ID of the user to retrieve profile page data for
 * @query {string} req.query.page_number - The page number for pagination. In this API pagination is only implemented for user posts
 * @query {string} req.query.page_size - The page size for pagination. In this API pagination is only implemented for user posts
 * @returns {Object} - An object containing profile page data of user including username, profile picture, total user likes, total user followers, total user following, user posts and top suggested creators
 * @throws {Error} - If there is error retrieving user profile page data or validation issues
 */
router.get("/:user_id", rateLimiter(), inputValidator, async (req, res, next) => {
    try {
        const userID = req.params.user_id; // getting userID and converting to integer
        const { page_number, page_size } = req.query; // getting page number and page size

        // QUERIES
        const userNameQuery = 'SELECT username, profile_picture FROM users WHERE id = $1'; // username and profile picture query
        const userFollowersQuery = 'SELECT following.user_id, users.username, users.profile_picture FROM following JOIN users on following.user_id = users.id WHERE following.user_following_id = $1'; // user followers query
        const userFollowingQuery = 'SELECT following.user_following_id, users.username, users.profile_picture FROM following JOIN users on following.user_following_id = users.id WHERE following.user_id = $1'; // user following query
        const userPostsQuery = 'SELECT id, title, description, video_name, thumbnail_name, created_at from posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $3 OFFSET (($2 - 1) * $3)'; // user posts query with pagination
        const topCreatorsQuery = 'SELECT id, username, profile_picture FROM users WHERE id <> $1 AND NOT EXISTS (SELECT $1 FROM following WHERE user_id = $1 AND user_following_id = users.id) ORDER BY RANDOM() LIMIT 8'; // top creators query, returns 8 random users that the user does not follow

        // EXECUTING QUERIES
        const [userNameProfile, userFollowers, userFollowing, userLikes, userPosts, topCreators] = await Promise.all([
            pgQuery(userNameQuery, userID),
            pgQuery(userFollowersQuery, userID),
            pgQuery(userFollowingQuery, userID),
            getDynamoRequestBuilder("Likes").query("user_id", parseInt(userID)).useIndex("user_id-created_at-index").exec(), // user likes query
            pgQuery(userPostsQuery, userID, page_number, page_size),
            pgQuery(topCreatorsQuery, userID)
        ]);

        // SETTING VALUES
        const userFollowersCount = userFollowers.rowCount; // total user follower count
        const userFollowingCount = userFollowing.rowCount; // total user following count
        const userLikesCount = userLikes.length; // total user likes count
        const updatedPostsData = await updatePosts(userPosts.rows, userID); // updating post objects to include further information

        // storing data as object
        const userDataObject = {
            username: userNameProfile.rows[0].username,
            profile_picture: userNameProfile.rows[0].profile_picture,
            total_user_likes: userLikesCount,
            total_user_followers: userFollowersCount,
            total_user_following: userFollowingCount,
            user_posts: updatedPostsData,
            top_creators: topCreators.rows
        }

        return res.status(200).json({ data: userDataObject }); // sending data to client

    } catch (error) {
        next(error); // server side error
    }
});

/**
 * Retrieves users that are followed by the user
 * 
 * @route GET /:user_id/following
 * @param {string} req.params.user_id - The ID of the user to retrieve users that are followed by the user
 * @query {string} req.query.page_number - The pageNumber for pagination
 * @query {string} req.query.page_size - The pageSize for pagination
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
 * @query {string} req.query.page_number - The pageNumber for pagination
 * @query {string} req.query.page_size - The pageSize for pagination
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

/**
 * Unfollows a user
 * 
 * @route GET /:userid
 * @param {string} req.params.user_id - The ID of the user that is unfollowing another user
 * @param {string} req.params.user_following_id - The ID of the user that is getting unfollowed
 * @returns {Object} - With a successful message
 * @throws {Error} - This must not unfollow the user
 */
router.delete("/unfollow/user/:user_id/following/:user_following_id", rateLimiter(), inputValidator, async (req, res, next) => {
    try {
        // Extract user IDs from request parameters
        const { user_id, user_following_id } = req.params;
        
        // Wrap each query in a function that returns a promise
        const verifyUserExistenceQuery = () => pgQuery(`SELECT * FROM users WHERE id = $1`, user_id);
        const verifyFollowingUserExistenceQuery = () => pgQuery(`SELECT * FROM users WHERE id = $1`, user_following_id);
        const checkFollowQuery = () => pgQuery(`SELECT * FROM following WHERE user_id = $1 AND user_following_id = $2`, user_id, user_following_id);
          
        // Use Promise.all() to run all queries concurrently
        const [verifyUserExistence, verifyFollowingUserExistence, checkFollow] = await Promise.all([
            verifyUserExistenceQuery(),
            verifyFollowingUserExistenceQuery(),
            checkFollowQuery()
        ]);
        
        // Verify the existence of the user based on their ID
        if (verifyUserExistence.rows.length === 0) {
            return res.status(400).json({ "error": "User not found" });
        }

        // Verify the existence of the user being followed based on their ID
        if (verifyFollowingUserExistence.rows.length === 0) {
            return res.status(400).json({ "error": "Following user not found" });
        }

        // Check if the user follows the target user
        if (checkFollow.rows.length === 0) {
            return res.status(400).json({ "error": "Not following user" });
        }
    
        // Delete the following relationship from the database
        const query = [
            `DELETE FROM following WHERE user_id = $1 AND user_following_id = $2`
        ];
        const values = [[user_id, user_following_id]];

        // helper function of database transaction
        const result = await makeTransactions(query, values);
    
        if (result.length === 0) {
            return res.status(400).json({ "error": "Follow not deleted" });
        }
    
        // Respond with success message
        return res.status(200).json({ "success": "user unfollowed" });
  
    }
    catch (err) {
        // Handle errors
        next(err);
    }
  });

/**
 * Follows A User
 * 
 * @route POST /follow/user/:user_id/following/:user_following_id
 * @param {string} req.params.user_id - The ID of the user that is following another user
 * @param {string} req.params.user_following_id - The ID of the user that is getting followed
 * @returns {Object} - With a successful message
 * @throws {Error} - This must not follow the user
 * */
router.post("/follow/user/:user_id/following/:user_following_id", rateLimiter(), inputValidator, async (req, res, next) => {
    try {
        // Extract user IDs from request parameter
        const { user_id, user_following_id } = req.params;
        
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

/**
 * Top creators query
 * 
 * @route GET /:user_id/topcreators
 * @param {string} req.query.user_id - The ID of the user to retrieve top creator users for
 * @query {string} req.query.page_number - The pageNumber for pagination
 * @query {string} req.query.page_size - The pageSize for pagination
 * @returns {Array} - An array of objects containing details of the users to follow
 * @throws {Error} - If there is error retrieving user details or validation issues
 */
router.get("/:user_id/topcreators", rateLimiter(), inputValidator, async (req, res, next) => {
    try {

        const userID = req.params.user_id; // retrieving userID
        const { page_number, page_size } = req.query; // getting page number and page size

        const query = 'SELECT id, username, profile_picture FROM users WHERE id <> $1 AND NOT EXISTS (SELECT $1 FROM following WHERE user_id = $1 AND user_following_id = users.id) ORDER BY RANDOM() LIMIT $3 OFFSET (($2 - 1) * $3)'; // top creators query, returns random users that the user does not follow
        const userFollowers = await pgQuery(query, userID, page_number, page_size);

        return res.status(200).json({ data: userFollowers.rows }); // sends details to client
    } catch (error) {
        next(error) // server side error
    }
});


/**
 * Update user profile detials 
 *
 * @route PUT /:user_id
 * @param {string} req.params.user_id - The ID of the user to update
 * @body
 *    {string} req.body.username - The username of the user
 *    {string} req.body.phone_number - The phone number of the user
 *    {string} req.body.user_bio - The bio of the user
 *    {string} req.body.gender - The gender of the user
 *    {date}   req.body.date_of_birth - The date of birth of the user
 *    {string} req.body.dietary_preferences - The dietary preferences of the user
 *    {string} req.body.country - The country of the user
 *    {string} req.body.shipping_address - The shipping address of the user
 *    {string} req.body.full_name - The full name of the user
 * @returns {Status} - Updated user profile status
 * @throws {Error} - If there are errors in user details retrieval or validation
 */
router.put("/profile_details/:user_id", rateLimiter(), inputValidator, async (req, res, next) => {
    try {
        // Getting user ID
        const {user_id } = req.params;

        // Getting user details
        const { phone_number, user_bio, gender, date_of_birth, dietary_preferences, country, shipping_address, full_name } = req.body;

       // Query to update user details
        const query = `
        UPDATE users
        SET phone_number = $1, user_bio = $2, gender = $3, date_of_birth = $4, dietary_preferences = $5, country = $6, shipping_address= $7, full_name= $8, 
        updated_at = NOW()
        WHERE id = $9`;

        // Execute the query
        await pgQuery(query, phone_number, user_bio, gender, date_of_birth, dietary_preferences, country, shipping_address, full_name, user_id);

        res.status(200).json({ "Status": "Profile Details Updated" });
    
    } catch (error) {
        next(error); // Handle server-side error
    }
});


/**
 * Update user profile picture
 *
 * @route PUT /:user_id
 * @param {string} req.params.user_id - The ID of the user to update
 * @returns {Status} - Updated user profile picture status
 * @throws {Error} - If there are errors in user details retrieval or validation
 */
router.put("/profile_picture/:user_id", rateLimiter(), upload.any(), inputValidator, async (req, res, next) => {
    try {
        // Getting user ID
        const user_id = req.params.user_id;

        const S3_PROFILE_PICTURE_PATH = "profile_pictures/active/";

        // Get the existing profile picture
        const existingProfilePictureQuery = "SELECT profile_picture FROM users WHERE id = $1";
        const existingProfilePicture = await pgQuery(existingProfilePictureQuery, user_id);

        const query = `
        UPDATE users
        SET profile_picture = $1, updated_at = NOW()
        WHERE id = $2`;
        console.log(req.files[0]);
        //here check if the existing profile picture is the not null then delete the existing profile picture
        if (existingProfilePicture.rows[0].profile_picture !== "") {
        
            await s3Delete(existingProfilePicture.rows[0].profile_picture);
            const newProfilePictureName = await s3Upload(req.files[0], S3_PROFILE_PICTURE_PATH);
            console.log("new profile picture" + newProfilePictureName);
            pgQuery(query, newProfilePictureName, user_id);
            res.status(200).json({ "Status": "Profile Picture Updated" });

        } else {
            console.log("new profile picture" + newProfilePictureName);
            pgQuery(query, newProfilePictureName, user_id);
            res.status(200).json({ "Status": "Profile Picture Updated" });
        }


    } catch (error) {
        next(error); // Handle server-side error
    }
});


export default router;