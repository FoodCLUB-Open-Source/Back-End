/* For video/image posting routes */
import multer, { memoryStorage } from "multer";
import { Router } from "express";
import { validationResult } from "express-validator";

import getDynamoRequestBuilder from "../dynamoDB.js";
import inputValidator from "../middleware/input_validator.js";
import pgPool from "../pgdb.js";
import rateLimiter from "../middleware/rate_limiter.js";

import { pgQuery, s3Delete, s3Retrieve, s3Upload } from "../functions/general_functions.js";
import { validateGetCategoryPost, validateGetPosts, validateParamId } from "../functions/validators/posts_validators.js";

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


/* Posting a post to the database roll backs are included incase any query goes wrong. */
router.post("/:user_id", inputValidator, rateLimiter(500, 15), upload.any(), async (req, res, next) => {
  try {

    const userId = parseInt(req.params.user_id);
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
      const postValues = [userId, title, description, newVideoName, newThumbNaileName];
      const newPost = await client.query(insertPostQuery, postValues);
      
      const { post_id } = newPost.rows[0];

      const insertRecipeQuery = 'INSERT INTO recipes (post_id, recipe_description, recipe_ingredients, recipe_equipment, recipe_steps, preparation_time, serving_size, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())';
      const recipeValues = [post_id, recipe_description, recipe_ingredients, recipe_equipment, recipe_steps, preparation_time, serving_size];
      
      const updatePostQuery = 'INSERT INTO posts_categories (post_id, category_name) VALUES ($1, $2)';
      const postUpdateValues = [post_id, category];
      
      const [recipe_table, category_table] = await Promise.all([
        client.query(insertRecipeQuery, recipeValues),
        client.query(updatePostQuery, postUpdateValues)
      ]);

      await client.query('COMMIT');
      
      console.log("Video Posted" + post_id);
      res.status(200).json({ Status: "Video Posted" });

    } catch (err) {

      await Promise.all([
        s3Delete(req.files[0], S3_POST_PATH),
        s3Delete(req.files[1], S3_POST_PATH)
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

/**
 * Retrieves post details of a specific post based off post ID
 * 
 * @route GET /post/:post_id
 * @param {string} req.params.post_id - The ID of the post to retrieve details for
 * @returns {Object} - An object containing details of the post such as id, title, description, video URL, thumbnail URL, details of user who posted the post, post likes count, post comments count and post view count
 * @throws {Error} - If there is error retrieving post details or validation issues
 */
router.get("/:post_id", rateLimiter(), inputValidator, async (req, res, next) => {
  try {
    const postID = req.params.post_id; // retrieving post ID

    const query = 'SELECT p.id, p.title, p.description, p.video_name, p.thumbnail_name, u.username, u.profile_picture from posts p JOIN users u ON p.user_id = u.id WHERE p.id = $1'; // query to get post details and user who has posted details

    const postDetails = await pgQuery(query, postID); // performing query

    if (postDetails.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // getting video_name and thumbnail_name URL's
    const [videoUrl, thumbnailUrl] = await Promise.all([
      s3Retrieve(postDetails.rows[0].video_name),
      s3Retrieve(postDetails.rows[0].thumbnail_name),
    ]);

    // getting users who liked and viewed the post to get total number of likes and views (NEED TO ADD COMMENTS COUNT)
    const postLikeCount = await getDynamoRequestBuilder("Likes").query("post_id", parseInt(postID)).exec();
    const postViewCount = await getDynamoRequestBuilder("Views").query("post_id", parseInt(postID)).exec();

    // adding URLs to posts data and removing video_name and thumbnail_name
    postDetails.rows[0].video_url = videoUrl;
    postDetails.rows[0].thumbnail_url = thumbnailUrl;
    delete postDetails.rows[0].video_name;
    delete postDetails.rows[0].thumbnail_name;

    // adding post total likes and views count to posts data
    postDetails.rows[0].total_likes = postLikeCount.length;
    postDetails.rows[0].total_views = postViewCount.length;

    return res.status(200).json({ data: postDetails.rows }); // sending data to client
  } catch (error) {
    next(error); // server side error
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

export default router;