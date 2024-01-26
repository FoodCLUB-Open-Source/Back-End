/* For video/image posting routes */
import { Router } from "express";
import multer, { memoryStorage } from "multer";

import inputValidator from "../middleware/input_validator.js";
import rateLimiter from "../middleware/rate_limiter.js";

import { checkLike, checkView, makeTransactions, pgQuery, s3Delete, s3Retrieve, s3Upload } from "../functions/general_functions.js";
import getDynamoRequestBuilder from "../config/dynamoDB.js";
import redis from "../config/redisConfig.js";
import pgPool from "../config/pgdb.js";
import { verifyTokens, verifyUserIdentity } from "../middleware/verify.js";

const router = Router();
const storage = memoryStorage();
const upload = multer({ storage: storage })


/* Testing Posts Route */
router.get("/testing/test/:post_id", inputValidator, async (req, res) => {
  try {
    console.log(req.params);

    res.status(200).json({ "Testing": "Working Posts", "Value": req.body});
  } catch (err) {
    console.error(err.message);
  }
});

/* Functions for Posts */
const removeLikesAndViews = async (post_id) => { 
  const Likes = await getDynamoRequestBuilder("Likes").query("post_id", parseInt(post_id)).exec();
  const Views = await getDynamoRequestBuilder("Views").query("post_id", parseInt(post_id)).exec();

  // Prepare the list of items to delete from the 'Likes' table
  const likesToDelete = Likes.map((item) =>  ({ post_id: item.post_id, user_id: item.user_id }));

  // Prepare the list of items to delete from the 'Views' table
  const viewsToDelete = Views.map((item) => ({ post_id: item.post_id, user_id: item.user_id }));

  // Create an array of delete requests for 'Likes' and 'Views' tables
  const deleteRequests = [
    {
      tableName: "Likes",
      items: likesToDelete,
    },
    {
      tableName: "Views",
      items: viewsToDelete,
    },
  ];

  // Perform batch deletions
  deleteRequests.forEach(async (deleteRequest) => {
    const { tableName, items } = deleteRequest;
    await performBatchDeletion(tableName, items);
  });

}



/**
 * Uploading a Post, video and recipe
 * 
 * @route POST /:userid
 * @body {string} req.body - This contains all of the information needed for creating a post.
 * @returns {Object} - Returns a status of video posted if successful
 * @throws {Error} - If there are errors, the post must not be posted. and any posted information needs to be rolled back.
 */
router.post("/", inputValidator, rateLimiter(500, 15), verifyTokens, upload.any(), async (req, res, next) => {
  try {

    const { payload } = req.body;
    const user_id = payload.user_id;
    const { title, description, recipe_description, preparation_time, serving_size, category } = req.body;
    let { recipe_ingredients, recipe_equipment, recipe_steps } = req.body;

    recipe_ingredients = JSON.parse(recipe_ingredients);
    recipe_equipment = JSON.parse(recipe_equipment);
    recipe_steps = JSON.parse(recipe_steps);

    const S3_POST_PATH = "posts/active/";
    //Used to upload to s3 bucket
    const [newVideoName, newThumbNaileName] = await Promise.all([
      s3Upload(req.files[0], S3_POST_PATH),
      s3Upload(req.files[1], S3_POST_PATH)
    ]);

    const client = await pgPool.connect();

    try {
      await client.query('BEGIN');
      
      const insertPostQuery = 'INSERT INTO posts (user_id, title, description, video_name, thumbnail_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id as post_id';
      const postValues = [user_id, title, description, newVideoName, newThumbNaileName];
      const newPost = await client.query(insertPostQuery, postValues);
      
      const { post_id } = newPost.rows[0];

      const insertRecipeQuery = 'INSERT INTO recipes (post_id, recipe_description, recipe_ingredients, recipe_equipment, recipe_steps, preparation_time, serving_size, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())';
      const recipeValues = [post_id, recipe_description, recipe_ingredients, recipe_equipment, recipe_steps, preparation_time, serving_size];
      
      const updatePostQuery = 'INSERT INTO posts_categories (post_id, category_name) VALUES ($1, $2)';
      const postUpdateValues = [post_id, category];
      
      await Promise.all([
        client.query(insertRecipeQuery, recipeValues),
        client.query(updatePostQuery, postUpdateValues)
      ]);

      await client.query('COMMIT');
      
      console.log("Video Posted " + post_id);
      res.status(200).json({ Status: "Video Posted" });

    } catch (err) {

      await Promise.all([
        s3Delete(S3_POST_PATH + req.files[0]),
        s3Delete(S3_POST_PATH + req.files[1])
      ]);

      await client.query('ROLLBACK');
      next(err);

    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

/**
 * Retrieves post details of a specific post based off post ID
 * 
 * @route GET /posts/:post_id/user_id
 * @param {string} req.params.post_id - The ID of the post to retrieve details for
 * @returns {Object} - An object containing details of the post such as id, title, description, video URL, thumbnail URL, details of user who posted the post, post likes count, post comments count and post view count
 * @throws {Error} - If there is error retrieving post details or validation issues do not retrieve anything
 */
router.get("/:post_id", rateLimiter(), inputValidator, verifyTokens, async (req, res, next) => {
  try {

    const { post_id } = req.params; 
    const { payload } = req.body;
    const user_id = payload.user_id;
    const query = 'SELECT p.id, p.title, p.description, p.video_name, p.thumbnail_name, u.username, u.profile_picture from posts p JOIN users u ON p.user_id = u.id WHERE p.id = $1'; // query to get post details and user who has posted details
    const postDetails = await pgQuery(query, post_id); // performing query

    if (postDetails.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const updatedPosts = await updatePosts(postDetails.rows, user_id);

    return res.status(200).json({ data: updatedPosts }); // sending data to client
  } catch (error) {
    next(error); // server side error
  }
});


/**
 * Delete a specific post
 * 
 * @route POST /:post_id
 * @body {string} req.params.post_id - Id of the post that is neeeded
 * @returns {status} - A successful status indicates that posts have been deleted
 * @throws {Error} - If there are errors dont delete any post.
 */
router.delete("/:post_id", rateLimiter(), verifyUserIdentity, inputValidator, async (req, res, next) => {
  try {

    const { post_id } = req.params;

    // Fetch post details from the database
    const post = await pgQuery(`SELECT * FROM posts WHERE id = $1`, post_id);

    // Ensure the post is present in the database or not
    if (post.rows.length === 0) {
       return res.status(404).json({ error: "Post not found." });
    }

    // Extract the video_name, thumbnail_name and user_id from the post
     const { video_name, thumbnail_name, user_id } = post.rows[0];

     await pgQuery(`DELETE FROM posts WHERE id = $1`, post_id);
    // Delete files from S3 and remove likes/views
    await Promise.all([
       s3Delete(video_name),
       s3Delete(thumbnail_name),
       removeLikesAndViews(post_id)
    ]);

    res.status(200).json({ "Status": "Post Deleted" });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a list of posts for a particular category
 * 
 * @route GET /category/:category_id/:user_id
 * @param {string} req.params.category_id - ID of the category that is needed
 * @query {number} req.query.page_size - Number of posts to fetch per page (optional, default: 15)
 * @query {number} req.query.page_number - Page number to fetch (optional, default: 1)
 * @returns {Object} - Returns an array of posts for the specified category
 * @throws {Error} - If there are errors, no posts are retrieved
 */

router.get("/category/:category_id", rateLimiter(), verifyTokens, inputValidator, async (req, res, next) => {
  try {
    const { payload } = req.body;
    const user_id = payload.user_id;
    // Extract category ID from URL parameters
    const { category_id } = req.params;

    // Pagination settings
    // Get query parameters for pagination
    let pageSize = parseInt(req.query.page_size) || 15; 
    let currentPage = parseInt(req.query.page_number) || 1; 

    pageSize = pageSize == 0 ? 1 : pageSize;
    currentPage = currentPage == 0 ? 1 : currentPage;

    
    // Calculate the offset based on page size and page number
    const offset = (currentPage - 1) * pageSize;

    // Key for Redis cache
    const cacheKey = `CATEGORY|${category_id}`;

    // Check if data is already cached
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      
      // Return cached data if available
      // IMPORTANT: If you update a post, remember to delete this cache
      // For example, if you update post with ID 2:
      // const cacheKeys = await redis.keys(`category:${category}:page:*`);
      // await redis.del('category:' + categoryId + ':page:' + currentPage);

      const cachedPosts = JSON.parse(cachedData);
      const paginatedPosts = {};
      paginatedPosts.posts = cachedPosts.posts.slice(offset, offset + pageSize);

      //For testing cache proccess
      console.log("Cache Hit");
      return res.status(200).json(paginatedPosts);
    }

    // SQL query to fetch specific category posts
    const query = `
      SELECT *
      FROM posts p
      INNER JOIN posts_categories pc ON p.id = pc.post_id
      WHERE pc.category_name IN (SELECT name FROM categories WHERE id = $1)
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    // Execute the query with parameters
    const specificCategoryPosts = await pgQuery(query, category_id, pageSize, offset);

    // Process the posts to add video and thumbnail URLs, view_count ,like_count
    const updatedPosts = await updatedPosts(specificCategoryPosts.rows, user_id);

    // Cache the data in Redis for a certain amount of time (e.g., 1 hour)
    //expirey timer 3600 seconds = 1 hour
    await redis.setEx(cacheKey, 3600, JSON.stringify({ "posts": updatedPosts }));
    console.log("Cache Miss");

   // Respond with an object containing the "posts" key and the 15 array of objects with post information
   res.status(200).json({ "posts": processedPosts });
 } catch (err) {
   next(err);
 }
});

/**
 * Get Posts For The Home Page
 * For now random posts later implement the Algorithm
 * @route GET /posts/homepage/:user_id
 * @returns {posts} - Array of objects of post information
 * @throws {Error} - If there are errors dont retrieve any posts.
 */
router.get("/homepage/user", inputValidator, rateLimiter(), verifyTokens, async (req, res, next) => {
      // getting user ID
  const { payload } = req.body
  const user_id = payload.user_id
  try {

    // getting posts liked by user
    const postLikeCount = await getDynamoRequestBuilder("Likes").query("user_id", parseInt(user_id)).useIndex("user_id-created_at-index").exec();

    // extracting post ID's
    const likedPosts = postLikeCount.map(post => post.post_id);

    // Convert the array to an array literal
    const likedPostsLiteral = `{${likedPosts.join(',')}}`;

    // Get query parameters for pagination
    const pageSize = parseInt(req.query.page_size) || 15; 
    const currentPage = parseInt(req.query.page_number) || 1;
    
    // Calculate the offset based on page size and page number
    const offset = (currentPage - 1) * pageSize;

    // SQL query to fetch specific category posts
    const query = `
          SELECT id, title, description, video_name, thumbnail_name, created_at
          FROM posts
          WHERE id != ALL ($1::integer[])
          ORDER BY RANDOM()
          LIMIT $2 OFFSET $3;
    `;

    // Execute the query with parameters
    const randomPosts = await pgQuery(query, likedPostsLiteral, pageSize, offset);

    // Process the posts to add video and thumbnail URLs
    const updatedPosts = await updatePosts(randomPosts.rows, user_id);

    // Respond with an object containing the "posts" key and the 15 array of objects with post information
    res.status(200).json({ "posts": processedRandomPosts });
 } catch (err) {
   next(err);
 }
});


/**
 * Update Post Title and Title Description
 * 
 * @route PUT /posts/:post_id
 * @param {string} req.params.post_id - The ID of the post to update
 * @body {string} req.body.title - The updated title
 * @body {string} req.body.description - The updated title description
 * @returns {Object} - Returns a status indicating the update was successful
 * @throws {Error} - If there are errors during the update
 */
router.put("/:post_id", verifyUserIdentity, inputValidator, rateLimiter(), async (req, res, next) => {
  try {
    const { post_id } = req.params;
    const { title, description } = req.body;

    console.log(post_id);
    
    // Update the post title and title description
    try {
      await pgQuery('UPDATE posts SET title = $1, description = $2, updated_at = NOW() WHERE id = $3', title, description, post_id);
    } catch (error) {
      return res.status(500).json({ message: "Post not updated" });
    }
    res.status(200).json({ Status: "Post Title and Title Description Updated" });

  } catch (err) {
    next(err);
  }
});


export default router;
