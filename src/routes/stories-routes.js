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



// Testing stories
router.get("/testing", async (req, res, next) => {
  try {
    res.status(200).json({ Status: "Stories" });
  } catch (err) {
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
      return res.status(404).json({ Error: "Story not found" });
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
      return res.status(500).json({ Error: "Error deleting files from S3" });
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