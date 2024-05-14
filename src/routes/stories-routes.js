/* For stories routes */
import { Router } from "express";
import multer, { memoryStorage } from "multer";
import inputValidator from "../middleware/input_validator.js";
import rateLimiter from "../middleware/rate_limiter.js";


import { pgQuery, s3Delete, s3Upload, s3Retrieve, getUserInfoFromIdToken } from "../functions/general_functions.js";
import getDynamoRequestBuilder from "../config/dynamoDB.js";

import { setStory } from "../dynamo_schemas/dynamo_schemas.js";
import { verifyTokens } from "../middleware/verify.js";

const router = Router();
const storage = memoryStorage();
const upload = multer({ storage: storage });


// Testing stories
router.get("/testing", async (req, res, next) => {
  try {
    res.status(200).json({ Status: "Stories" });
  } catch (err) {
    next(err);
  }
});

/**
 * Retrieves stories of users that are followed by the user 
 * This endpoint needs a request header called 'Authorisation' with both the access token and the ID token 
 * 
 * @route GET /following_stories
 * @query {string} req.query.page_number - The page number for pagination.
 * @query {string} req.query.page_size - The page size for pagination.
 * @returns {status} - If successful, returns 200 and a JSON object containing story information such as story id, video URL, thumbnail URL, view count, created at. Else returns 400 and a JSON object with associated error message
 * @throws {Error} - If there is error retrieving stories
 */
router.get("/following_stories", rateLimiter(), verifyTokens, inputValidator, async (req, res, next) => {
  try {
    const page_size = parseInt(req.query.page_size) || 15;
    const page_number = parseInt(req.query.page_number) || 1;
    const { payload } = req.body;
    const userID = payload.user_id;


    if (isNaN(page_number) || isNaN(page_size)) {
      return res.status(400).json({ message: "Invalid page_number or page_size" });
    }
    // getting users the user follows
    const query = "SELECT following.user_following_id, users.username, users.profile_picture FROM following JOIN users on following.user_following_id = users.id WHERE following.user_id = $1 ORDER BY following.created_at ASC"; // returns the users that are followed by the user with pagination
    const userFollowing = await pgQuery(query, userID); // executing query
    const userStoryMap = {}; // object to organize stories by user

    // Use Promise.all to wait for all queries to complete
    Promise.all(
      userFollowing.rows.map(async (user) => {
        try {
          let stories = await getDynamoRequestBuilder("Stories").query("user_id", parseInt(user.user_following_id)).useIndex("user_id-created_at-index").scanIndexDescending().exec(); // querying dynamoDB to get user stories

          // filtering out stories that are older than 24 hours
          const ONE_DAY = 1000 * 60 * 60 * 24; // one day in milliseconds
          stories = stories.filter(story => {
            const timeDiff = Date.now() - Date.parse(story.created_at);
            return timeDiff < ONE_DAY;
          });

          if (stories.length === 0) return; // no recent stories for user

          if (!userStoryMap[user.user_following_id]) { // checking if userStoryMap contains user details
            // if not user details are created and stored
            userStoryMap[user.user_following_id] = {
              user_id: user.user_following_id,
              profile_picture: user.profile_picture,
              username: user.username,
              full_name: user.full_name, // added full name
              stories: [],
            };
          }
          stories.forEach(async (story) => { // processing all user stories
            // retrieving URLs and replacing them in the story object
            const imageUrl = await s3Retrieve(story.image_url);
            const thumbnailURL = await s3Retrieve(story.thumbnail_url);
            story.image_url = imageUrl;
            story.thumbnail_url = thumbnailURL;

            let storiesList = userStoryMap[user.user_following_id].stories;
            storiesList = [...storiesList, {
              story_id: story.story_id,
              thumbnail_url: story.thumbnail_url,
              image_url: story.image_url,
              created_at: story.created_at,
            }];
            userStoryMap[user.user_following_id].stories = storiesList;
          });

        } catch (error) {
          console.error(error);
          return res.status(400).json({ error: error });
        }
      })
    ).then(() => {
      // converting the userStoryMap object to an array
      const userStoriesArray = Object.values(userStoryMap);
      // sending data to client
      return res.status(200).json({ stories: userStoriesArray });
    }).catch((error) => {
      console.error(error);
      return res.status(400).json({ error: error });
    });
  } catch (error) {
    next(error); // server side error
  }
});

/**
 * Retrieves a user's  saved stories
 * This endpoint needs a request header called 'Authorisation' with both the access token and the ID token 
 * 
 * @route GET /user/:user_id
 * @query {string} req.query.page_number - The page number for pagination
 * @query {String} req.query.page_size - The page size for pagination
 * @returns {status} - If successful, returns 200 and a JSON object of  list of stories that have been saved sorted by created_at, else returns 400 and a JSON object with message set to 'Invalid page_number or page_size', else returns 500 and error message
 * @throws {Error} - If there is error in retrieving stories
 */
router.get("/user", rateLimiter(), verifyTokens, inputValidator, async (req, res, next) => {
  try {
    const { payload } = req.body;
    const user_id = payload.user_id;
    const pageSize = parseInt(req.query.page_size) || 15;
    const page_number = parseInt(req.query.page_number) || 1;

    if (isNaN(page_number) || isNaN(pageSize)) {
      return res.status(400).json({ message: "Invalid page_number or page_size" });
    }

    // Query to retrive user details from database
    const query = "SELECT full_name, username, profile_picture FROM users WHERE id=$1";
    const userDetails = await pgQuery(query, parseInt(user_id));

    if (userDetails.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userDetail = userDetails.rows[0];
    // Calculate the offset based on page size and page number
    const offset = (page_number - 1) * pageSize;
    console.log("The offset number is: ", offset);
    try {
      const stories = await getDynamoRequestBuilder("Stories")
        .query("user_id", parseInt(user_id))
        .useIndex("user_id-created_at-index")
        .scanIndexDescending()
        .exclusiveStartKey(offset > 0 ? { created_at: stories[offset - 1].created_at } : undefined) // Use startKey for pagination
        .limit(pageSize)
        .exec();

      // Check if stories array is not empty before sorting
      if (stories && stories.length > 0) {
        console.log("First DynamoDB Item:", stories[0]);
      }

      // Sort the stories according to created_at so latest stories show first
      const savedStories = stories.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Use map to concurrently retrieve S3 URLs for video and thumbnail
      const s3Promises = savedStories.map(async (story) => {
        story.imageUrl = await s3Retrieve(story.imageUrl);
        story.thumbnail_url = await s3Retrieve(story.thumbnail_url);
        return {
          story_id: story.story_id,
          imageUrl: story.imageUrl,
          thumbnail_url: story.thumbnail_url,
          created_at: story.created_at,
          view_count: story.view_count,
        };
      });

      // Wait for all promises to resolve
      const updatedStories = await Promise.all(s3Promises);

      const user_details = {
        user_id: user_id,
        full_name: userDetail.full_name,
        user_name: userDetail.username,
        profile_picture: userDetail.profile_picture,
        saved_stories: [...updatedStories]
        // Include other user details as needed
      };


      res.status(200).json({ stories: user_details });
    } catch (err) {

      return res.status(500).json({ message: err });
    }
  } catch (err) {
    console.log(err);
    next(err);
  }
});

/**
 * Retrieves stories of a user
 * This endpoint needs a request header called 'Authorisation' with both the access token and the ID token 
 * 
 * @route GET /:user_id
 * @returns {status} - If successful, returns 200 and a JSON object containing story information such as story id, video URL, thumbnail URL, view count, created at, else returns 404 and a JSON object with message set to 'User not found'
 * @throws {Error} - If there is error retrieving stories
 */
router.get("/", rateLimiter(), /*verifyTokens,*/ inputValidator, async (req, res, next) => {
  try {
    //we get the id of the user in string format
    const { payload } = req.body;
    const user_id = payload.user_id;

    // Query to retrive user details from database
    const query = "SELECT full_name, username, profile_picture FROM users WHERE id=$1";
    const userDetails = await pgQuery(query, parseInt(user_id));

    if (userDetails.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userDetail = userDetails.rows[0];
    //retrive all storeis realted to the user
    const userStories = await getDynamoRequestBuilder("Stories")
      .query("user_id", user_id)
      .useIndex("user_id-created_at-index")
      .scanIndexDescending()
      .exec();

    const ONE_DAY = 1000 * 60 * 60 * 24; // One day in milliseconds

    //filter the story
    const filteredStories = userStories.filter((story) => {
      const timeDiff = Date.now() - Date.parse(story.created_at);
      return timeDiff < ONE_DAY;
    });

    //change the name of the sotry into url form
    const s3Promises = filteredStories.map(async (story) => {
      story.imageUrl = await s3Retrieve(story.imageUrl);
      story.thumbnail_url = await s3Retrieve(story.thumbnail_url);
      return story;
    });

    //wait for all the promises to be executed and store the urls in the updates Srotes varaible
    const updatedStories = await Promise.all(s3Promises);

    // user details and stories
    const user_details = {
      user_id: user_id,
      full_name: userDetail.full_name,
      user_name: userDetail.username,
      profile_picture: userDetail.profile_picture,
      users_stories: [...updatedStories]

    };
    //return the variable object
    res.status(200).json({ stories: user_details });
  } catch (err) {
    next(err);
  }
});

/**
 * User Posts a Story.
 *  This route allows users to create a new story,
 *  Including uploading a video and a thumbnail. 
 *  The video should be attached as the first file in req.files[0], 
 *  The thumbnail should be attached as the second file in req.files[1].
 * This endpoint needs a request header called 'Authorisation' with both the access token and the ID token 
 * 
 * @route POST /stories/:user_id
 * @returns {status} - If successful, returns 200 and a JSON object with status set to 'Story Posted', else returns 500 and a JSON object with message set to 'Story Post Failed'
 * @throws {Error} - If any errors occur during the creation process, including file uploads. The story won't be insert into dynamodb, then delete the uploaded filess.
 * @description 
 *       This route allows users to create a new story,
 *       Including uploading a image and a thumbnail. 
 *       The image should be attached as the first file in req.files[0], 
 *       The thumbnail should be attached as the second file in req.files[1].
 */
router.post("/", rateLimiter(), verifyTokens, inputValidator, upload.any(), async (req, res, next) => {
  try {
    let user = await getUserInfoFromIdToken(req.headers.authorisation.split(" ")[2])
    let user_id = user.user_id

    // Define S3 bucket paths for storing files
    // const S3_STORY_PATH = "stories/active/";
    const S3_IMAGE_PATH = "stories/active/";

    try {
      // Upload the first file (image) and the second file (thumbnail) to an S3 bucket

      if (!req.files || !req.files[0].mimetype.startsWith("image/")) {
        return res.status(400).json({ message: "Invalid file format. Only images are allowed." });
      }

      const newImageName = await s3Upload(req.files[0], S3_IMAGE_PATH);

      const currentTime = new Date();
      const StorySchema = setStory(parseInt(user_id), newImageName, null, currentTime.toISOString());

      // Insert the StorySchema object into the DynamoDB Stories table
      await getDynamoRequestBuilder("Stories").put(StorySchema).exec();

      // Respond with a success message
      res.status(200).json({ Status: "Image Posted" });



      // Respond with a success messages
      // res.status(200).json({ Status: "Story Posted" });

    } catch (err) {
      //if any error in the DynamoDB, delete the files from S3

      await s3Delete(req.file, S3_IMAGE_PATH);

      // Throw the error to the next error handler
      res.status(500).json({ message: "Story Post Failed" });
    }

  } catch (err) {
    // Throw the error to the next error handler
    next(err);
  }
});


/*
router.post("/:user_id", inputValidator, rateLimiter(), upload.single('image'), async (req, res, next) => {
  try {
    // Parse the user_id from the request parameters
    const { user_id } = req.params;
    // Define S3 bucket path for storing image files
    const S3_IMAGE_PATH = "images/active/";
  
    try {
      // Upload the image file to an S3 bucket
      const newImageName = await s3Upload(req.file, S3_IMAGE_PATH);

      // Create a StorySchema object with user_id and image URL
      const StorySchema = setStory(parseInt(user_id), newImageName, null);
    
      // Insert the StorySchema object into the DynamoDB Stories table
      await getDynamoRequestBuilder("Stories").put(StorySchema).exec();

      // Respond with a success message
      res.status(200).json({ Status: "Image Posted" });

    } catch (err) {
      // If any error in DynamoDB, delete the uploaded file from S3
      await s3Delete(req.file, S3_IMAGE_PATH);

      // Throw the error to the next error handler
      res.status(500).json({  message: "Image Post Failed" });
    }

  } catch (err) {
    // Throw the error to the next error handler
    next(err);
  }
});
*/

/**
 * Deletes a user's story.
 *  This route allows the user to delete their story.
 *  It deletes the story from the DynamoDB and removes associated files from the S3 bucket.
 * This endpoint needs a request header called 'Authorisation' with both the access token and the ID token 
 * 
 * @route DELETE stories/story/story_id/user
 * @param {any} req.params.story_id - The ID of the story.
 * @returns {status} - If successful, returns 200 and a JSON object with status set to 'Story Deleted', else returns 404 and a JSON object with message set to 'Story not found' OR returns 500 and a JSON object with message set to 'Error deleting files from S3'
 * @throws {Error} - If any error occurs during the deletion process.
 */
router.delete("/story/:story_id/user", rateLimiter(), verifyTokens, inputValidator, async (req, res, next) => {
  try {
    // Parse the user_id from the request parameters
    const { story_id } = req.params;
    const { payload } = req.body;
    const user_id = payload.user_id;

    // Get the story from the Stories table for image and thumbnail URLs to delete from the S3 bucket
    const getStory = await getDynamoRequestBuilder("Stories")
      .query("user_id", parseInt(user_id))
      .exec();

    if (getStory.length === 0) {
      return res.status(404).json({ message: "Story not found" });
    }

    // get the image and thumbnail paths and story_id
    const { image_url, thumbnail_url, } = getStory[0];

    // Delete the image and thumbnail from the S3 bucket
    try {
      await Promise.all([
        s3Delete(image_url),
        s3Delete(thumbnail_url)
      ]);
    } catch (err) {
      // Handle errors here or log them for debugging
      console.error("Error deleting files from S3:", err);
      return res.status(500).json({ message: "Error deleting files from S3" });
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
