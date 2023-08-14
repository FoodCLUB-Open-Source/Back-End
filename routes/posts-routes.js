/* For video/image posting routes */
import multer, { memoryStorage } from "multer";
import { Router } from "express";
import { validationResult } from "express-validator";

import getDynamoRequestBuilder from "../dynamoDB.js";
import inputValidator from "../middleware/input_validator.js";
import pgPool from "../pgdb.js";
import rateLimiter from "../middleware/rate_limiter.js";

import { pgQuery, s3Delete, s3Retrieve, s3Upload } from "../functions/general_functions.js";
import { setPostStats } from "../dynamo_schemas/dynamo_schemas.js";
import { validateGetCategoryPost, validateGetPosts, validateParamId } from "../functions/validators/posts_validators.js";
import redis from "../redisConfig.js";

const router = Router();
const storage = memoryStorage();
const upload = multer({ storage: storage })

/* Testing Posts Route */
router.get("/testing/:user_id/test/:post_id", inputValidator, async (req, res) => {
  try {
    console.log(req.params);

    res.json({ "Testing": "Working Posts", "Value": req.body});
  } catch (err) {
    console.error(err.message);
  }
});

/* Functions for Posts */
/* returns the total likes and views per post */
const getPostStats = async (postId) => getDynamoRequestBuilder("Post_Stats")
  .query("post_id", JSON.stringify(postId))
  .execSingle();

/* returns the total likes and views per post */
const removeLikesViews = async (postId) => await getDynamoRequestBuilder("Post_Stats")
  .delete("post_id", postId)
  .exec();

/* Checks if a user has liked a post or not, returns true or false */
const checkLike = async (postId, userId) => await getDynamoRequestBuilder("Likes")
  .query("post_id", postId)
  .whereSortKey("user_id").eq(userId)
  .execSingle();

/* Posting a post to the database */
router.post("/posts/:user_id", inputValidator, rateLimiter(5, 15), upload.any(), async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const { post_title, post_description, category_id_list, hashtag_id_list, recipe_description, recipe_ingredients, recipe_equipment, recipe_steps, recipe_preparation_time, recipe_serving } = req.body;

    //Used to upload to s3 bucket
    const [newVideoName, newThumbNaileName] = await Promise.all([
      s3Upload(req.files[0]),
      s3Upload(req.files[1])
    ]);

    const client = await pgPool.connect();

    try {
      await client.query('BEGIN');

      const insertRecipeQuery = 'INSERT INTO recipes (recipe_description, recipe_ingredients, recipe_equipment, recipe_steps, preparation_time, recipe_servings) VALUES ($1, $2, $3, $4, $5, $6) RETURNING recipe_id';
      const recipeValues = [recipe_description, JSON.parse(recipe_ingredients), JSON.parse(recipe_equipment), JSON.parse(recipe_steps), recipe_preparation_time, recipe_serving];
      const { rows } = await client.query(insertRecipeQuery, recipeValues);

      const { recipe_id } = rows[0];

      const insertPostQuery = 'INSERT INTO posts (user_id, post_title, post_description, video_name, thumbnail_name, category_id_list, hashtag_id_list, recipe_id, post_created_at, post_updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *';
      const postValues = [userId, post_title, post_description, newVideoName, newThumbNaileName, JSON.parse(category_id_list), JSON.parse(hashtag_id_list), recipe_id];
      const newPost = await client.query(insertPostQuery, postValues);
      
      const { post_id } = newPost.rows[0];

      const updatePostQuery = 'UPDATE recipes SET post_id = $1 WHERE recipe_id = $2';
      const postUpdateValues = [post_id, recipe_id];
      await client.query(updatePostQuery, postUpdateValues);

      const postStatsSchema = setPostStats(post_id);
      
      await getDynamoRequestBuilder("Post_Stats")
        .put(postStatsSchema)
        .exec();

      console.log("Video Posted" + post_id);
      await client.query('COMMIT');

      res.json(newPost.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

/* Get a specific post and its category
  /api/posts/getpost/8?user_id=3
*/
router.get("/:id", inputValidator, rateLimiter() , async (req, res, next) => {
  try {
    const errors = validationResult(req);
  
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const postId = parseInt(req.params.id);
    
    //NEED TO UPDATE THIS TO THE NEW CATEGORY SYSTEM
    // const specificPost = await pgQuery(`
    //   SELECT posts.*, users.*, categories.*, posts.created_at AS post_created_at, posts.updated_at AS post_updated_at 
    //   FROM posts JOIN users ON posts.user_id = users.id JOIN categories ON posts.category_id = categories.category_id 
    //   WHERE id = $1`
    //   , postId
    // )

    const specificPost = await pgQuery(`
      SELECT 
      posts.id as post_id, posts.user_id, posts.title, posts.description, posts.video_name, posts.thumbnail_name, posts.created_at AS post_created_at,
      users.username, users.profile_picture,
      categories.name AS category_name
      FROM posts 
      JOIN users ON posts.user_id = users.id 
      JOIN posts_categories ON posts.id = posts_categories.post_id 
      JOIN categories ON posts_categories.category_name = categories.name
      WHERE posts.id = $1`
      , postId
    );

    console.log("https://ddhluc7rgemr3.cloudfront.net/".length);

    if (!specificPost.rows[0]) res.status(400).json({ error: `No Post With Id Of ${postId}`});

    const { post_id, user_id, title, description, video_name, thumbnail_name, post_created_at, username, profile_picture, category_name } = specificPost.rows[0];

    const [videoUrl, thumbnailUrl, postStats, liked] = await Promise.all([
      s3Retrieve(video_name),
      s3Retrieve(thumbnail_name),
      getPostStats(post_id),
      //checkLike(post_id, parseInt(req.query.user_id))
    ]);

    const { view_count, like_count, comments_count } = postStats;
    
    const responseData = {
      post_id,
      user_id,
      title,
      description,
      videoUrl,
      thumbnailUrl,
      post_created_at,
      username,
      profile_picture,
      category_name,
      view_count,
      like_count,
      comments_count,
      liked,
      video_name,
      thumbnail_name,
    };

    res.json(responseData);
  } catch (err) {
    next(err);
  }
});

/* Deletes a specific post */
router.delete("/posts/:id", rateLimiter(), validateParamId(), async (req, res, next) => {
  try {
    const errors = validationResult(req);
  
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const postId = req.params.id;

    const post = await pgQuery(`SELECT * FROM posts WHERE post_id = $1`, postId);

    const { video_name, thumbnail_name } = post.rows[0];
    
    //CHANGE THIS SO THAT IF ONE DOESNT HAPPEN NONE DO
    //MAYBE CREATE A DELETE FOLDER IN S3. To allow rollback
    await Promise.all([
      s3Delete(video_name),
      s3Delete(thumbnail_name),
      pgQuery(`DELETE FROM posts WHERE post_id = $1`, postId),
      removeLikesViews(parseInt(postId))
    ]);

    console.log("Post Deleted");
    res.json({"Status": "Image Deleted"});
  } catch (err) {
    next(err);
  }
});

/* Get 15 random posts */
router.get("/homepage/posts", rateLimiter(), validateGetPosts(), async (req, res, next) => {
  try {
    const errors = validationResult(req);
  
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    //THIS NEEDS TO CHANGE TO CORRESPOND TO THE NEW CATEGORY SYSTEM.
    //NEEDS TO ADD PAGINATION AND CACHHING
    const randomPosts = await pgQuery(`
      SELECT posts.*, users.*, categories.*
      FROM posts JOIN users ON posts.user_id = users.user_id JOIN categories ON posts.category_id = categories.category_id
      ORDER BY RANDOM() LIMIT 15;
    `);
    
    const processedPosts = await Promise.all(
      randomPosts.rows.map(async (post) => {
        const videoUrl = await s3Retrieve(post.video_name);
        const thumbnailUrl = await s3Retrieve(post.thumbnail_name);
        
        const { video_name, thumbnail_name, phone_number, password, email, gender, created_at, updated_at,  ...rest } = post;
        
        const { view_count, like_count } = await getLikesViews(post.post_id);

        const liked = await checkLike(parseInt(post.post_id), parseInt(req.query.user_id));

        return { ...rest, video_url: videoUrl, thumbnail_url: thumbnailUrl, view_count, like_count, liked };
      })
    );
    
    res.json({"posts": processedPosts});
  } catch (err) {
    next(err);
  }
});

/* Getting Ingredient For Specific Post */
router.get("/posts/recipe/:id", rateLimiter(), validateParamId(), async (req, res, next) => {
  try {
    const errors = validationResult(req);
  
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const recipeId = req.params.id;
    const specificRecepie = await pgQuery(`SELECT * FROM recipes WHERE recipe_id = $1`, recipeId);

    res.json({"recipe": specificRecepie.rows[0]});
  } catch (err) {
    next(err);
  }
});

/* Posting For Sending Video To Friend */
router.post("/posts/sendvideo", rateLimiter(),  async (req, res, next) => {
  try {
    //Will need to update the messages table. and update a sent table.
  } catch (err) {
    next(err);
  }
});

/* Get 15 random posts for a specific category */
router.get("/categoryposts/:id", rateLimiter(), validateGetCategoryPost(), async (req, res, next) => {
  try {
    const errors = validationResult(req);
  
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    //REQUIRES PAGINATION AND CACHING
    const categoryId = req.params.id;

    // CHANGE THIS TO MATCH THE NEW CATEGORY SYSTEM
    const randomPosts = await pgQuery(`
      SELECT posts.*, users.*, categories.*, posts.created_at AS post_created_at, posts.updated_at AS post_updated_at 
      FROM posts 
      JOIN users ON posts.user_id = users.user_id 
      JOIN categories ON posts.category_id = categories.category_id 
      WHERE categories.category_id = $1
      ORDER BY RANDOM() LIMIT 15;
    `, categoryId);

    const processedPosts = await Promise.all(
      randomPosts.rows.map(async (post) => {

        const videoUrl = await s3Retrieve(post.video_name);
        const thumbnailUrl = await s3Retrieve(post.thumbnail_name);
        
        const { video_name, thumbnail_name, phone_number, password, email, gender, created_at, updated_at,  ...rest } = post;
        
        const { view_count, like_count } = await getLikesViews(post.post_id);

        const liked = await checkLike(parseInt(post.post_id), parseInt(req.query.user_id));

        return { ...rest, video_url: videoUrl, thumbnail_url: thumbnailUrl, view_count, like_count, liked };
      })
    );

    res.json({"posts": processedPosts});
  } catch (err) {
    next(err);
  }
});


/* Get Specific Posts By Category */
router.get("/category/:category_id", rateLimiter(), inputValidator, async (req, res, next) => {
  try {
    
    // Extract category ID from URL parameters
    const categoryId = req.params.category_id;

    // Pagination settings
    // Number of posts per page
    const pageSize = 15; 
    // Current page number from query parameter
    const currentPage = parseInt(req.query.page) || 1; 
    const offset = (currentPage - 1) * pageSize;

    // Key for Redis cache
    const cacheKey = `CATEGORY|${categoryId}|PAGE|${currentPage}`;

    // Check if data is already cached
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      
      // Return cached data if available
      // IMPORTANT: If you update a post, remember to delete this cache
      // For example, if you update post with ID 2:
      // const cacheKeys = await redis.keys(`category:${category}:page:*`);
      // await redis.del('category:' + categoryId + ':page:' + currentPage);
      const cachedPosts = JSON.parse(cachedData);

      //For testing cache proccess
      console.log("cache data  is working ");
      return res.status(200).json(cachedPosts);
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
    const specificCategoryPosts = await pgQuery(query, categoryId, pageSize, offset);

    // Process the posts to add video and thumbnail URLs, view_count ,like_count
    const processedPosts = await Promise.all(
      specificCategoryPosts.rows.map(async (post) => {
        const videoUrl = await s3Retrieve(post.video_name);
        const thumbnailUrl = await s3Retrieve(post.thumbnail_name);

        const { video_name, thumbnail_name, ...rest } = post;

        return { ...rest, video_url: videoUrl, thumbnail_url: thumbnailUrl };
      })
    );

    // Cache the data in Redis for a certain amount of time (e.g., 1 hour)
    await redis.setEx(cacheKey, 3600, JSON.stringify({ "posts": processedPosts }));

    // Respond with an object containing the "posts" key and the 15 array of objects with post information
    res.status(200).json({ "posts": processedPosts });
  } catch (err) {
    next(err);
  }
});

export default router;