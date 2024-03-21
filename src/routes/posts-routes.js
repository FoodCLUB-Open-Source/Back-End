/* For video/image posting routes */
import {
  Router
} from "express";
import multer, {
  memoryStorage
} from "multer";

import inputValidator from "../middleware/input_validator.js";
import rateLimiter from "../middleware/rate_limiter.js";

import {
  checkLike,
  checkView,
  getUserInfo,
  makeTransactions,
  pgQuery,
  s3Delete,
  s3Retrieve,
  s3Upload,
  stringToUUID,
  updatePosts
} from "../functions/general_functions.js";
import getDynamoRequestBuilder from "../config/dynamoDB.js";
import redis from "../config/redisConfig.js";
import pgPool from "../config/pgdb.js";
import {
  verifyTokens,
  verifyUserIdentity
} from "../middleware/verify.js";

const router = Router();
const storage = memoryStorage();
const upload = multer({
  storage: storage
});


/* Testing Posts Route */
router.get("/testing/test/:post_id", inputValidator, async (req, res) => {
  try {

    res.status(200).json({
      "Testing": "Working Posts",
      "Value": req.body
    });
  } catch (err) {
    console.error(err.message);
  }
});



/**
 * Retrieves posts -- this is meant to be used with query parameters to
 * search for posts. Without query parameters, this returns ALL posts,
 * which is very expensive and in general SHOULD NOT be used.
 *
 * Currently, only the username (of the creator of the post)
 * and post title parameters are supported.
 *
 * @route GET /
 * @param {any} req.query.username - Username of the profile to search for
 * @param {any} req.query.title - Title of the post to search for
 * @returns {status} - If successful, returns 200 and a JSON object with the posts, else returns 400 and a JSON object with the message set to 'Unknown error occurred.'
 */
router.get("/", rateLimiter(), inputValidator, async (req, res, next) => {
  try {
    const {
      username = "", title = ""
    } = req.query;
    const query = `
      SELECT p.id, p.title, p.thumbnail_name, u.username, u.profile_picture
      FROM users u
      JOIN posts p
      ON p.user_id = u.id
      WHERE p.title ILIKE ('%' || $1 || '%') AND u.username ILIKE ('%' || $2 || '%')
    `;

    let posts = await pgQuery(query, title, username);
    posts = posts.rows

    for (let i = 0; i < posts.length; i++) {
      posts[i].user = await getUserInfo(posts[i].username)
    }
    return res.status(200).json({
      data: posts
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      message: "Unknown error occurred."
    });
  }
});

/**
 * Uploading a Post, video and recipe
 * 
 * @route POST /
 * @body {string} req.body - This contains all of the information needed for creating a post.
 * @returns {status} - If successful, returns 200 and a JSON object with status set to 'Video Posted'
 * @throws {Error} - If there are errors, the post must not be posted and any posted information needs to be rolled back.
 */
router.post("/", inputValidator, verifyTokens, rateLimiter(500, 15), upload.any(), async (req, res, next) => {
  try {
    const {
      payload
    } = req.body;
    const user_id = payload.user_id;

    const {
      title,
      description,
      recipe_description,
      preparation_time,
      serving_size,
      category
    } = req.body;

    let {
      recipe_ingredients,
      recipe_equipment,
      recipe_steps
    } = req.body;

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
      await client.query("BEGIN");

      const insertPostQuery = "INSERT INTO posts (user_id, title, description, video_name, thumbnail_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id as post_id";
      const postValues = [user_id, title, description, newVideoName, newThumbNaileName];
      const newPost = await client.query(insertPostQuery, postValues);

      const {
        post_id
      } = newPost.rows[0];

      const insertRecipeQuery = "INSERT INTO recipes (post_id, recipe_description, recipe_ingredients, recipe_equipment, recipe_steps, preparation_time, serving_size, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())";
      const recipeValues = [post_id, recipe_description, recipe_ingredients, recipe_equipment, recipe_steps, preparation_time, serving_size];

      const updatePostQuery = "INSERT INTO posts_categories (post_id, category_name) VALUES ($1, $2)";
      const postUpdateValues = [post_id, category];

      try {
        //loop through all ingridients
        for (let i = 0; i < recipe_ingredients.length; i++) {
          const currentIngridients = recipe_ingredients[i]
          //get current ingridient id and change id to UUID
          const currentIngridientsUUID = await stringToUUID(currentIngridients.id)

          //checkto see if current ingridients exisits in db.
          const exists = await pgQuery("SELECT * FROM Ingredients WHERE id=$1", currentIngridientsUUID)
          //add to db if the ingridients doesnt exists
          if (exists.rows.length < 1) {
            const insertIngridientQuery = " INSERT INTO Ingredients (id,item_name, image_url, hints)VALUES ($1,$2,$3,$4)"
            const ingridientValues = [currentIngridientsUUID, currentIngridients.item_name, currentIngridients.image_url, currentIngridients.hints]
            client.query(insertIngridientQuery, ingridientValues)
          }
        }
      } catch (err) {
        return res.status(400).json({
          error: err
        })
      }

      await Promise.all([
        client.query(insertRecipeQuery, recipeValues),
        client.query(updatePostQuery, postUpdateValues)
      ]);

      await client.query("COMMIT");

      console.log("Video Posted " + post_id);
      res.status(200).json({
        Status: "Video Posted"
      });

    } catch (err) {

      await Promise.all([
        s3Delete(S3_POST_PATH + req.files[0]),
        s3Delete(S3_POST_PATH + req.files[1])
      ]);

      await client.query("ROLLBACK");
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
 * @param {any} req.params.post_id - The ID of the post to retrieve details for
 * @returns {status} - If successful, returns 200 and a JSON object containing details of the post such as id, title, description, video URL, thumbnail URL, details of user who posted the post, post likes count, post comments count and post view count.
 *                     Else, returns 404 and a JSON object with error message set to 'Post not found'
 * @throws {Error} - If there is error retrieving post details or validation issues do not retrieve anything
 */

router.get("/:post_id", rateLimiter(), verifyTokens, inputValidator, async (req, res, next) => {
  try {
    const post_id = req.params.post_id;
    const { payload } = req.body;
    const user_id = payload.user_id;


    const query = "SELECT p.id, p.title, p.description, p.video_name, p.thumbnail_name, u.username, u.profile_picture FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = $1";
    const postDetails = await pgQuery(query, post_id);

    if (postDetails.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = postDetails.rows[0];

    // Array to store promises for s3Retrieve calls
    const s3Promises = [];

    // Check if video_name exists and retrieve it from S3
    if (post.video_name) {
      s3Promises.push(s3Retrieve(post.video_name));
    }

    // Check if thumbnail_name exists and retrieve it from S3
    if (post.thumbnail_name) {
      s3Promises.push(s3Retrieve(post.thumbnail_name));
    }

    // Wait for all s3Retrieve promises to resolve
    const s3Results = await Promise.all(s3Promises);

    // Update postDetails with S3 retrieval results
    if (post.video_name) {
      post.video_name = s3Results.shift();
    }
    if (post.thumbnail_name) {
      post.thumbnail_name = s3Results.shift();
    }

    // Retrieve user information asynchronously
    const userInfo = await getUserInfo(post.username);
    // Wait for user info retrieval
    console.log(userInfo)

    // Construct the response object
    post.user = {
      id: userInfo.id,
      username: userInfo.username,
      profile_picture: await s3Retrieve(userInfo.profile_picture)
    };

    return res.status(200).json({ data: post });
  } catch (error) {
    next(error); // server side error
  }
});


/**
 * Delete a specific post
 * 
 * @route POST /:post_id
 * @body {string} req.params.post_id - Id of the post that is neeeded
 * @returns {status} - If successful, returns 200 and a JSON object with Status set to 'Post Deleted', else returns 404 with a JSON object with error set to 'Post not found.'
 * @throws {Error} - If there are errors dont delete any post.
 */
router.delete("/:post_id", rateLimiter(), verifyUserIdentity, inputValidator, async (req, res, next) => {
  try {

    const {
      post_id
    } = req.params;

    // Fetch post details from the database
    const post = await pgQuery("SELECT * FROM posts WHERE id = $1", post_id);

    // Ensure the post is present in the database or not
    if (post.rows.length === 0) {
      return res.status(404).json({
        error: "Post not found."
      });
    }

    // Extract the video_name, thumbnail_name and user_id from the post
    const {
      video_name,
      thumbnail_name,
      user_id
    } = post.rows[0];

    await pgQuery("DELETE FROM posts WHERE id = $1", post_id);
    // Delete files from S3 and remove likes/views
    await Promise.all([
      s3Delete(video_name),
      s3Delete(thumbnail_name),
      removeLikesAndViews(post_id)
    ]);

    res.status(200).json({
      "Status": "Post Deleted"
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a list of posts for a particular category
 * 
 * @route GET /category/:category_id/:user_id
 * @param {any} req.params.category_id - ID of the category that is needed
 * @query {number} req.query.page_size - Number of posts to fetch per page (optional, default: 15)
 * @query {number} req.query.page_number - Page number to fetch (optional, default: 1)
 * @returns {status} - If successful, returns 200 and a JSON object with an array of posts for the specified category
 * @throws {Error} - If there are errors, no posts are retrieved
 */

router.get("/category/:category_id", verifyTokens, rateLimiter(), inputValidator, async (req, res, next) => {
  try {
    const {
      payload
    } = req.body;
    const user_id = payload.user_id;
    // Extract category ID from URL parameters
    const {
      category_id
    } = req.params;

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
    let updatedPosts = await updatePosts(specificCategoryPosts.rows, user_id);

    for (let i = 0; i < updatedPosts.length; i++) {
      // Fetch the content creator details for each post
      let contentCreator = await pgQuery("SELECT username, full_name FROM users WHERE id = $1", updatedPosts[i].user_id);

      // Check if the content creator details exist
      if (contentCreator.rows.length > 0) {
        // Assign content creator details to the updated post
        updatedPosts[i].content_creator = {
          username: contentCreator.rows[0].username,
          full_name: contentCreator.rows[0].full_name
        };
      } else {
        // If content creator details are not found, set content_creator to null
        updatedPosts[i].content_creator = null;
      }
    }
    console.log(updatedPosts)
    // Respond with an object containing the "posts" key and the 15 array of objects with post information
    res.status(200).json({
      "posts": updatedPosts
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get Posts For The Home Page
 * For now random posts later implement the Algorithm
 * @route GET /posts/homepage/user
 * @returns {status} - If successful, returns 200 and a JSON object with an array of objects of post information
 * @throws {Error} - If there are errors dont retrieve any posts.
 */
router.get("/homepage/user", inputValidator, rateLimiter(), verifyTokens, async (req, res, next) => {
  // getting user ID
  const {
    payload
  } = req.body;
  const user_id = payload.user_id;

  try {
    // Get posts liked by the user
    const postLikeCount = await getDynamoRequestBuilder("Likes").query("user_id", user_id).useIndex("user_id-created_at-index").exec();

    // Extract post IDs
    const likedPosts = postLikeCount.map(post => post.post_id);

    // Convert the array to an array literal
    const likedPostsLiteral = `{${likedPosts.join(",")}}`;

    // Get query parameters for pagination
    const pageSize = parseInt(req.query.page_size) || 15;
    const currentPage = parseInt(req.query.page_number) || 1;

    // Calculate the offset based on page size and page number
    const offset = (currentPage - 1) * pageSize;

    // SQL query to fetch homepage posts with additional user information
    const query = `
      SELECT p.id, p.title, p.description, p.video_name, p.thumbnail_name, p.created_at,
             u.username, u.full_name, u.id as user_id, u.profile_picture,
             COALESCE((SELECT COUNT(*) FROM bookmarks b WHERE b.user_id = $1 AND b.post_id = p.id), 0) AS is_bookmarked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id != ALL ($2::integer[])
      ORDER BY RANDOM()
      LIMIT $3 OFFSET $4;
    `;

    // Execute the query with parameters
    const randomPosts = await pgQuery(query, user_id, likedPostsLiteral, pageSize, offset);

    // Process the posts to add video and thumbnail URLs, like count, and view count
    const processedRandomPosts = await Promise.all(
      randomPosts.rows.map(async (post) => {
        const videoUrl = await s3Retrieve(post.video_name);
        const thumbnailUrl = await s3Retrieve(post.thumbnail_name);

        const likeCount = await getDynamoRequestBuilder("Likes").query("post_id", post.id).exec();
        const viewCount = await getDynamoRequestBuilder("Views").query("post_id", post.id).exec();

        const isLiked = await checkLike(post.id, user_id);
        const isViewed = await checkView(post.id, user_id);

        return {
          ...post,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          like_count: likeCount.length,
          view_count: viewCount.length,
          is_liked: isLiked,
          is_viewed: isViewed,
        };
      })
    );

    // Respond with an object containing the "posts" key and the array of objects with post information
    res.status(200).json({
      posts: processedRandomPosts
    });
  } catch (err) {
    next(err);
  }
});


/**
 * Update Post Title and Title Description
 * 
 * @route PUT /posts/:post_id
 * @param {any} req.params.post_id - The ID of the post to update
 * @body {string} req.body.title - The updated title
 * @body {string} req.body.description - The updated title description
 * @returns {status} - If successful, returns 200 and a JSON object with Status set to 'Post Title and Title Description Updated', else returns 500 and a JSON object with message set to 'Post not updated'
 * @throws {Error} - If there are errors during the update
 */
router.put("/:post_id", verifyUserIdentity, inputValidator, rateLimiter(), async (req, res, next) => {
  try {
    const {
      post_id
    } = req.params;
    const {
      title,
      description
    } = req.body;

    // Update the post title and title description
    try {
      await pgQuery("UPDATE posts SET title = $1, description = $2, updated_at = NOW() WHERE id = $3", title, description, post_id);
    } catch (error) {
      return res.status(500).json({
        message: "Post not updated"
      });
    }
    res.status(200).json({
      Status: "Post Title and Title Description Updated"
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Retrieves user posts based on search text 
 * 
 * @route GET posts/search/user-posts
 * @param {any} req.body.search_text - Text to search for in user posts
 * @returns {status} If successful, returns 200 and a JSON object of the users and posts matching the search criteria, else returns 500 and a JSON object with response set to 'Internal server error'
 * @throws {Error} If there are errors, no posts are retrieved
 */
router.get("/search/user-posts", rateLimiter(), inputValidator, async (req, res) => {
  try {
    // Extract search text from request body
    const {
      search_text
    } = req.body;

    // Define SQL queries
    const usersQuery = `
      SELECT id, username, profile_picture
      FROM users
      WHERE LOWER(username) LIKE LOWER($1)
    `;
    const postsQuery = `
      SELECT *
      FROM posts
      WHERE LOWER(title) LIKE LOWER($1)
    `;

    // Execute SQL queries to fetch users and posts
    const users = await pgQuery(usersQuery, `%${search_text}%`);
    const posts = await pgQuery(postsQuery, `%${search_text}%`);

    // Iterate through posts to fetch content creators. We only need content creators for posts
    for (let i = 0; i < posts.rows.length; i++) {
      const {
        id,
        user_id,
        title,
        description,
        video_name,
        thumbnail_name,
        created_at,
        updated_at
      } = posts.rows[i];

      // Query for content creator based on user_id
      const contentCreatorQuery = await pgQuery(
        "SELECT id, username, profile_picture FROM users WHERE id=$1", user_id
      );
      const contentCreator = contentCreatorQuery.rows[0];

      // Update current post with content creator information
      posts.rows[i] = {
        id,
        user_id,
        title,
        description,
        video_name,
        thumbnail_name,
        created_at,
        updated_at,
        contentCreator
      };
    }

    // Send response with users and posts data
    res.status(200).json({
      users: users.rows,
      posts: posts.rows
    });
  } catch (error) {
    // Handle errors
    console.error("Error in search query:", error);
    res.status(500).json({
      response: "Internal server error"
    });
  }
});

export default router;