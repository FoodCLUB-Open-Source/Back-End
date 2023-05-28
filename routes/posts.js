/* For video/image posting routes */

const express = require("express")
const { pgQuery, makeTransactions, s3Upload, s3Retrieve, s3Delete } = require('../functions/general_functions')
const { validationResult } = require('express-validator')
const { requestLimiter } = require("../functions/general_functions")
const { validatePostVideo, validateGetPost } = require('../functions/validators')

const pool = require("../pgdb")

const multer = require('multer')
const { getItemPrimaryKey, getItemPartitionKey, putItem, deleteItem } = require('../functions/dynamoDB_functions');
const { setPostStats } = require("../dynamo_schemas/dynamo_schemas")

const router = express.Router()
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })


/* Testing Posts Route */
router.get("/testing", async (req, res) => {
  try {
    removeLikesViews(8)
    res.json({ "Testing": "Working Posts"})
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
router.post("/postvideo/:id", requestLimiter, upload.any(), validatePostVideo(), async (req, res, next) => {
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

    console.log(recipe_ingredients)
    console.log(recipe_equipment)
    console.log(recipe_steps)

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








/* Get a specific post and its category
  /api/posts/getpost/8?user_id=3
*/
router.get("/getpost/:id", requestLimiter, validateGetPost(), async (req, res, next) => {
  try {

    const errors = validationResult(req)
  
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const postId = parseInt(req.params.id)
    
    const specificPost = await pgQuery(`
      SELECT posts.*, users.*, categories.*, posts.created_at AS post_created_at, posts.updated_at AS post_updated_at 
      FROM posts JOIN users ON posts.user_id = users.user_id JOIN categories ON posts.category_id = categories.category_id 
      WHERE post_id = $1`
      , postId
    )

    if (!specificPost.rows[0]){ res.status(400).json({ error: `No Post With Id Of ${postId}`})}

    const { post_id, user_id, post_title, post_description, video_name, thumbnail_name, name, category_id,
    username, profile_picture, post_created_at, post_updated_at } = specificPost.rows[0]

    const [videoUrl, thumbnailUrl, postStats, liked] = await Promise.all([
      s3Retrieve(video_name),
      s3Retrieve(thumbnail_name),
      getPostStats(postId),
      checkLike(postId, parseInt(req.query.user_id))
    ])

    const { view_count, like_count, comments_count } = postStats
    
    const responseData = {
      post_id,
      user_id,
      post_title,
      post_description,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      category_name: name,
      category_id,
      username,
      profile_picture,
      post_created_at,
      post_updated_at,
      view_count,
      like_count,
      comments_count,
      liked
    }

    res.json(responseData)
  } catch (err) {
    next(err)
  }
})




















/* Deletes a specific post */
router.delete("/deletepost/:id", async (req, res) => {
  try {

    const postId = req.params.id

    const post = await pgQuery(`SELECT * FROM posts WHERE post_id=$1`, postId)

    await s3Delete(post.rows[0].video_name)
    await s3Delete(post.rows[0].thumbnail_name)

    await pgQuery(`DELETE FROM posts WHERE post_id = $1`, postId)

    await removeLikesViews(parseInt(postId))

    console.log("Post Deleted")
    res.json({"Status": "Image Deleted"})
  } catch (err) {
    console.error(err.message)
  }
})


/* Get 15 random posts */
router.get("/homepage/getposts", async (req, res) => {
  try {

    const randomPosts = await pgQuery(`
      SELECT posts.*, users.*, categories.*, posts.created_at AS post_created_at, posts.updated_at AS post_updated_at 
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
    console.error(err.message)
  }
})

/* Getting Ingredient For Specific Post */
router.get("/getrecipe/:id", async (req, res) => {
  try {
    const recipeId = req.params.id
    const specificRecepie = await pgQuery(`SELECT * FROM recipes WHERE recipe_id = $1`, recipeId)

    res.json({"recipe": specificRecepie.rows[0]})

  } catch (err) {
    console.error(err.message)
  }
})


/* Posting For Sending Video To Friend */
router.post("/homepage/postsendvideo", async (req, res) => {
  try {
    //Will need to update the messages table. and update a sent table.

 
  } catch (err) {
    console.error(err.message)
  }
})


/* Get 15 random posts for a specific category */
router.get("/discover/getcategoryposts/:category", async (req, res) => {
  try {
    const categoryId = req.params.category

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
    console.error(err.message)
  }
})

module.exports = router;