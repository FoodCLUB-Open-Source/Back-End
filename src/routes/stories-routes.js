/* For stories routes */
import { Router } from "express";
import multer, { memoryStorage } from "multer";
import inputValidator from "../middleware/input_validator.js";
import rateLimiter from "../middleware/rate_limiter.js";

import { s3Delete, s3Upload } from "../functions/general_functions.js";
import getDynamoRequestBuilder from "../config/dynamoDB.js";

import { setStory } from "../dynamo_schemas/dynamo_schemas.js";

const router = Router();
const storage = memoryStorage();
const upload = multer({ storage: storage })


// Testing stories
router.get("/testing", async (req, res, next) => {
  try {
    res.status(200).json({ Status: "Stories" });
  } catch (err) {
    next(err);
  }
});

/**
 * User Posts a Story.
 * 
 * @route POST /stories/:user_id
 * @param {string} req.params.user_id - The ID of the user.
 * @returns {Object} - Returns a status object indicating that the story was successfully created.
 * @throws {Error} - If any errors occur during the creation process, including file uploads. The story won't be insert into dynamodb, then delete the uploaded filess.
 * @description 
 *       This route allows users to create a new story,
 *       Including uploading a video and a thumbnail. 
 *       The video should be attached as the first file in req.files[0], 
 *       The thumbnail should be attached as the second file in req.files[1].
 */
router.post("/:user_id", inputValidator, rateLimiter(), upload.any(), async (req, res, next) => {
  try {
    // Parse the user_id from the request parameters
    const { user_id } = req.params;
    // Define S3 bucket paths for storing files
    const S3_STORY_PATH = "stories/active/";
  
    try {
      // Upload the first file (video) and the second file (thumbnail) to an S3 bucket
      const [newVideoName, newThumbNaileName] = await Promise.all([
        s3Upload(req.files[0], S3_STORY_PATH),
        s3Upload(req.files[1], S3_STORY_PATH)
      ]);

      // Create a StorySchema object with user_id, video , and thumbnail 
      const StorySchema = setStory(parseInt(user_id), newVideoName, newThumbNaileName);
    
      // Insert the StorySchema object into the DynamoDB Stories table
      await getDynamoRequestBuilder("Stories").put(StorySchema).exec();

      // Respond with a success messages
      res.status(200).json({ Status: "Story Posted" });

    } catch (err) {
      //if any error in the DynamoDB, delete the files from S3
      await Promise.all([
        s3Delete(req.files[0], S3_STORY_PATH),
        s3Delete(req.files[1], S3_STORY_PATH)
      ]);

      // Throw the error to the next error handler
      res.status(500).json({ Status: "Story Post Failed" });
    }

  } catch (err) {
    // Throw the error to the next error handler
    next(err);
  }
});

export default router;