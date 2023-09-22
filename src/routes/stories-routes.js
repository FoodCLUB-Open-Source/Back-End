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
      res.status(500).json({  message: "Story Post Failed" });
    }

  } catch (err) {
    // Throw the error to the next error handler
    next(err);
  }
});


/**
 * Deletes a user's story.
 * 
 * @route DELETE stories/user/:user_id
 * @param {string} req.params.user_id - The ID of the user.
 * @returns {Object} - Returns a status indicating that the story was successfully deleted.
 * @throws {Error} - If any error occurs during the deletion process.
 * @description 
 *   This route allows the user to delete their story.
 *   It deletes the story from the DynamoDB and removes associated files from the S3 bucket.
 */
router.delete("/user/:user_id", inputValidator, rateLimiter(), async (req, res, next) => {
  try {
    // Parse the user_id from the request parameters
    const { user_id } = req.params;

    // Get the story from the Stories table for video and thumbnail URLs to delete from the S3 bucket
    const getStory = await getDynamoRequestBuilder("Stories")
      .query("user_id", parseInt(user_id))
      .exec();

    if (getStory.length === 0) {
      return res.status(404).json({  message: "Story not found" });
    }

    // get the video and thumbnail paths and story_id
    const { video_url, thumbnail_url, story_id } = getStory[0];

    // Delete the video and thumbnail from the S3 bucket
    try {
      await Promise.all([
        s3Delete(video_url),
        s3Delete(thumbnail_url)
      ]);
    } catch (err) {
      // Handle errors here or log them for debugging
      console.error("Error deleting files from S3:", err);
      return res.status(500).json({  message: "Error deleting files from S3" });
    }

    // Delete the story from the Stories table
     await getDynamoRequestBuilder("Stories")
     .delete("user_id", parseInt(user_id))
     .withSortKey("story_id", story_id)
     .exec();
      

    res.status(200).json({ Status: "Story Deleted" });

  } catch (err) {
    // Handle errors and pass them to the next error handler
      next(err);
  }
});

export default router;