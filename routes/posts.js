/* For video/image posting routes */

const express = require("express")
const { pgQuery, s3Upload, s3Retrieve, s3Delete } = require('../functions/general_functions')
const { param, validationResult } = require('express-validator')
const { validatePostVideo, validateGetPost, validateParamId, validateGetCategoryPost, validateGetPosts } = require('../functions/validators/posts_validators')

const pool = require("../pgdb")

const multer = require('multer')
const { getItemPrimaryKey, getItemPartitionKey, putItem, deleteItem } = require('../functions/dynamoDB_functions');
const { setPostStats } = require("../dynamo_schemas/dynamo_schemas")

const router = express.Router()
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })


const Redis = require("../redisConfig")

const rateLimiter = require("../middleware/rate_limiter")

// middleware to ensure postID is valid
const validatePostId = [
  param('postid').notEmpty().withMessage('Post ID is required.').isInt().withMessage('Post ID must be an integer.'),
  (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
      }
      next();
  }
];

/* Testing Posts Route */
router.get("/testing", rateLimiter(4, 15), async (req, res) => {
  try {
    
    await Redis.set('myKey', 'Hello Redis!');

    const value = await Redis.get('myKey');


    res.json({ "Testing": "Working Posts", "Value": value})

  } catch (err) {
    console.error(err.message)
  }
})
 

/* Functions for Posts */
/* returns the total likes and views per post */
async function getPostStats(postId){
  let params = {
		TableName: "Post_Stats",
		KeyConditionExpression: "post_id = :postId",
		ExpressionAttributeValues: {
		  ":postId": postId
		},
	} 

  const stats = await getItemPartitionKey(params)

  return stats[0]

} 

/* returns the total likes and views per post */
async function removeLikesViews(postId){

  let params = {
		TableName: "Post_Stats",
		Key: {
      post_id: postId
    }
	}

  await deleteItem(params)

  return "Deleted Posts"

} 

/* Checks if a user has liked a post or not, returns true or false */
async function checkLike(postId, userId) {
  
  const params ={
    TableName: "Likes",
    Key: {
      post_id: postId,
      user_id: userId
    }
  }

  const following = await getItemPrimaryKey(params)

  if (following) { return true }
  return false
}


/* Posting a post to the database */
router.post("/posts/:id", rateLimiter(5, 15), upload.any(), validatePostVideo(), async (req, res, next) => {
  try {

    const errors = validationResult(req)
  
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const userId = parseInt(req.params.id)
    const { post_title, post_description, category_id_list, hashtag_id_list, recipe_description, recipe_ingredients, recipe_equipment, recipe_steps, recipe_preparation_time, recipe_serving } = req.body

    //Used to upload to s3 bucket
    const [newVideoName, newThumbNaileName] = await Promise.all([
      s3Upload(req.files[0]),
      s3Upload(req.files[1])
    ])

    const client = await pool.connect();

    try {
      await client.query('BEGIN')

      const insertRecipeQuery = 'INSERT INTO recipes (recipe_description, recipe_ingredients, recipe_equipment, recipe_steps, preparation_time, recipe_servings) VALUES ($1, $2, $3, $4, $5, $6) RETURNING recipe_id';
      const recipeValues = [recipe_description, JSON.parse(recipe_ingredients), JSON.parse(recipe_equipment), JSON.parse(recipe_steps), recipe_preparation_time, recipe_serving];
      const { rows } = await client.query(insertRecipeQuery, recipeValues);

      const { recipe_id } = rows[0];

      const insertPostQuery = 'INSERT INTO posts (user_id, post_title, post_description, video_name, thumbnail_name, category_id_list, hashtag_id_list, recipe_id, post_created_at, post_updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *';
      const postValues = [userId, post_title, post_description, newVideoName, newThumbNaileName, JSON.parse(category_id_list), JSON.parse(hashtag_id_list), recipe_id];
      const newPost = await client.query(insertPostQuery, postValues)
      
      const { post_id } = newPost.rows[0]

      const updatePostQuery = 'UPDATE recipes SET post_id = $1 WHERE recipe_id = $2';
      const postUpdateValues = [post_id, recipe_id];
      await client.query(updatePostQuery, postUpdateValues)

      const postStatsSchema = setPostStats(post_id)
      await putItem("Post_Stats", postStatsSchema)

      console.log("Video Posted" + post_id)
      await client.query('COMMIT')

      res.json(newPost.rows[0])
    } catch (err) {
      await client.query('ROLLBACK')
      next(err)
    } finally {
      client.release()
    }
  } catch (err) {
    next(err)
  }
})

/**
 * Retrieves post details of a specific post based off post ID
 * 
 * @route GET /post/:postid
 * @param {string} req.params.postid - The ID of the post to retrieve details for
 * @returns {Object} - An object containing details of the post such as id, title, description, video URL, thumbnail URL, details of user who posted the post, post likes count, post comments count and post view count
 * @throws {Error} - If there is error retrieving post details or validation issues
 */
router.get("/post/:postid", rateLimiter(), validatePostId, async (req, res) => {
  try {
    const postID = parseInt(req.params.postid); // retrieving post ID
    const query = 'SELECT p.id, p.title, p.description, p.video_name, p.thumbnail_name, u.username, u.profile_picture from posts p JOIN users u ON p.user_id = u.id WHERE p.id = $1'; // query to get post details and user who has posted details
    const postDetails = await pgQuery(query, postID);
    const refinedPostDetails = await refinePostsData(postDetails.rows); // further refining posts data
    return res.status(200).json({ data: refinedPostDetails }); // sending data to client
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: error.message }); // server side error
  }
})

router.get("post/homepage", rateLimiter(), validatePostId, async (req, res) => {
  try {
    
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: error.message }); // server side error
  }
})

/**
 * Function that refines posts data to get video URL and thumbnail URL from s3 bucket. Additionally post comments count, like count and view count details are added
 * 
 * @param {Array} posts - array containing posts 
 * @returns {Array} - array with details refined
 */
async function refinePostsData(posts) {
  for (i = 0; i < posts.length; i++) {
      const post = posts[i]; // retrieving a post

      // getting post details such as ID, video name and thumbnail name
      const postID = post.id.toString();
      const videoName = post.video_name;
      const thumbnailName = post.thumbnail_name;

      // getting video and thumbnail URLs
      const videoURL = await s3Retrieve(videoName);
      const thumbnailURL = await s3Retrieve(thumbnailName);

      // adding video and thumbnail URL's as new attributes and deleting previous attributes
      post.video_url = videoURL;
      post.thumbnail_url = thumbnailURL;
      delete post.video_name;
      delete post.thumbnail_name;

      let params = { // parameter to get post details from Post_Stats table in DynamoDB
          TableName: "Post_Stats",
          KeyConditionExpression: "post_id = :postId",
          ExpressionAttributeValues: {
              ":postId": postID
          },
      }

      // request to Post_Stats table in dynamoDB to get likes count, comments count etc
      const postStats = await getItemPartitionKey(params);

      // adding attributes to post object
      post.comments_count = postStats[0].comments_count;
      post.like_count = postStats[0].like_count;
      post.view_count = postStats[0].view_count;
  }

  return posts;
}

/* Deletes a specific post */
router.delete("/posts/:id", rateLimiter(), validateParamId(), async (req, res, next) => {
  try {

    const errors = validationResult(req)
  
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const postId = req.params.id

    const post = await pgQuery(`SELECT * FROM posts WHERE post_id = $1`, postId)

    const { video_name, thumbnail_name } = post.rows[0]


    //CHANGE THIS SO THAT IF ONE DOESNT HAPPEN NONE DO
    //MAYBE CREATE A DELETE FOLDER IN S3. To allow rollback
    await Promise.all([
      s3Delete(video_name),
      s3Delete(thumbnail_name),
      pgQuery(`DELETE FROM posts WHERE post_id = $1`, postId),
      removeLikesViews(parseInt(postId))
    ])

    console.log("Post Deleted")
    res.json({"Status": "Image Deleted"})
  } catch (err) {
    next(err)
  }
})

/* Get 15 random posts */
router.get("/homepage/posts", rateLimiter(), validateGetPosts(), async (req, res, next) => {
  try {

    const errors = validationResult(req)
  
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    //THIS NEEDS TO CHANGE TO CORRESPOND TO THE NEW CATEGORY SYSTEM.
    //NEEDS TO ADD PAGINATION AND CACHHING
    const randomPosts = await pgQuery(`
      SELECT posts.*, users.*, categories.*
      FROM posts JOIN users ON posts.user_id = users.user_id JOIN categories ON posts.category_id = categories.category_id
      ORDER BY RANDOM() LIMIT 15;
    `)
    
    const processedPosts = await Promise.all(
      randomPosts.rows.map(async (post) => {

        const videoUrl = await s3Retrieve(post.video_name)
        const thumbnailUrl = await s3Retrieve(post.thumbnail_name)
        
        const { video_name, thumbnail_name, phone_number, password, email, gender, created_at, updated_at,  ...rest } = post
        
        const { view_count, like_count } = await getLikesViews(post.post_id)

        const liked = await checkLike(parseInt(post.post_id), parseInt(req.query.user_id))

        return { ...rest, video_url: videoUrl, thumbnail_url: thumbnailUrl, view_count, like_count, liked }
      })
    )
    
    res.json({"posts": processedPosts})

  } catch (err) {
    next(err)
  }
})

/* Getting Ingredient For Specific Post */
router.get("/posts/recipe/:id", rateLimiter(), validateParamId(), async (req, res, next) => {
  try {

    const errors = validationResult(req)
  
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const recipeId = req.params.id
    const specificRecepie = await pgQuery(`SELECT * FROM recipes WHERE recipe_id = $1`, recipeId)

    res.json({"recipe": specificRecepie.rows[0]})

  } catch (err) {
    next(err)
  }
})


/* Posting For Sending Video To Friend */
router.post("/posts/sendvideo", rateLimiter(),  async (req, res, next) => {
  try {
    //Will need to update the messages table. and update a sent table.

 
  } catch (err) {
    next(err)
  }
})


/* Get 15 random posts for a specific category */
router.get("/categoryposts/:id", rateLimiter(), validateGetCategoryPost(), async (req, res, next) => {
  try {

    const errors = validationResult(req)
  
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    //REQUIRES PAGINATION AND CACHING
    const categoryId = req.params.id

    // CHANGE THIS TO MATCH THE NEW CATEGORY SYSTEM
    const randomPosts = await pgQuery(`
      SELECT posts.*, users.*, categories.*, posts.created_at AS post_created_at, posts.updated_at AS post_updated_at 
      FROM posts 
      JOIN users ON posts.user_id = users.user_id 
      JOIN categories ON posts.category_id = categories.category_id 
      WHERE categories.category_id = $1
      ORDER BY RANDOM() LIMIT 15;
    `, categoryId)

    const processedPosts = await Promise.all(
      randomPosts.rows.map(async (post) => {

        const videoUrl = await s3Retrieve(post.video_name)
        const thumbnailUrl = await s3Retrieve(post.thumbnail_name)
        
        const { video_name, thumbnail_name, phone_number, password, email, gender, created_at, updated_at,  ...rest } = post
        
        const { view_count, like_count } = await getLikesViews(post.post_id)

        const liked = await checkLike(parseInt(post.post_id), parseInt(req.query.user_id))

        return { ...rest, video_url: videoUrl, thumbnail_url: thumbnailUrl, view_count, like_count, liked }
      })
    )

    res.json({"posts": processedPosts})

  } catch (err) {
    next(err)
  }
})

module.exports = router;