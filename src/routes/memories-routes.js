/* For stories routes */
import { Router, query } from "express";
import multer, { memoryStorage } from "multer";
import inputValidator from "../middleware/input_validator.js";
import rateLimiter from "../middleware/rate_limiter.js";
import { pgQuery, s3Delete, s3Upload, s3Retrieve, getUserInfoFromIdToken, checkReactionExists } from "../functions/general_functions.js";
import getDynamoRequestBuilder from "../config/dynamoDB.js";
import { verifyTokens } from "../middleware/verify.js";

const router = Router();
const storage = memoryStorage();
const upload = multer({ storage: storage });


// Testing stories
router.get("/testing", async (req, res, next) => {
    try {
        res.status(200).json({ Status: "Memories" });
    } catch (err) {
        next(err);
    }
});

/**
 * Retrieves memories  of users that have stored memories
 * This endpoint needs a request header called 'Authorisation' with both the access token and the ID token 
 * 
 * @route GET /following_stories
 * @query {string} req.query.page_number - The page number for pagination.
 * @query {string} req.query.page_size - The page size for pagination.
 * @returns {status} - If successful, returns 200 and a JSON object containing story information such as story id, video URL, thumbnail URL, view count, created at. Else returns 400 and a JSON object with associated error message
 * @throws {Error} - If there is error retrieving stories
 */

router.get("/", rateLimiter(), inputValidator, async (req, res, next) => {
    try {
        const { payload } = req.body;
        // const userID = payload.user_id;
        const userID = 251

        // Querying DynamoDB to get user stories
        let stories = await getDynamoRequestBuilder("Stories")
            .query("user_id", parseInt(userID))
            .useIndex("user_id-created_at-index")
            .scanIndexDescending()
            .exec();

        // Filter and process stories
        const filteredStories = [];
        for (let story of stories) {
            if (story.store_in_memory != null) {
                if (story.imageUrl != null) {
                    story.imageUrl = await s3Retrieve(story.imageUrl);
                }
                filteredStories.push(story);
            }
        }

        // Sort the filtered stories based on created_at in descending order
        filteredStories.sort((a, b) => {
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return res.status(200).json({ memories: filteredStories });
    } catch (error) {
        // Pass error to the next middleware
        next(error);
    }
});








export default router;
