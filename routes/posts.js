/* For video/image posting routes */

const express = require("express")
const { pgQuery, s3Upload, s3Retrieve, s3Delete } = require('../functions/general_functions')
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

  console.log(stats)
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
router.post("/postvideo", upload.any(), async (req, res) => {
  try {
    const { user_id, post_title, post_description, category_id } = req.body

    //Used to upload to s3 bucket
    const newVideoName = await s3Upload(req.files[0])
    const newThumbNaileName = await s3Upload(req.files[1])

    const newPost = await pgQuery(
      `INSERT INTO posts (user_id, post_title, post_description, video_name, thumbnail_name, category_id, created_at, updated_at) 
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
      user_id, post_title, post_description, newVideoName, newThumbNaileName, category_id
    )

    //INSERT RECIPE aswell

    const { post_id } = newPost.rows[0]
    
    const postStatsSchema = setPostStats(post_id)

		await putItem("Post_Stats", postStatsSchema)
    
    console.log("Video Posted")
    res.json(newPost.rows[0])
  } catch (err) {
    console.error(err.message)
  }
})

/* Get a specific post and its category
  /api/posts/getpost/8?user_id=3
*/
router.get("/getpost/:id", async (req, res) => {
  try {

    const postId = req.params.id
    
    const specificPost = await pgQuery(`
      SELECT posts.*, users.*, categories.*, posts.created_at AS post_created_at, posts.updated_at AS post_updated_at 
      FROM posts JOIN users ON posts.user_id = users.user_id JOIN categories ON posts.category_id = categories.category_id 
      WHERE post_id = $1`
      , postId
    )

    const { post_id, user_id, post_title, post_description, video_name, thumbnail_name, name, category_id,
    username, profile_picture, post_created_at, post_updated_at } = specificPost.rows[0]

    const videoUrl = await s3Retrieve(video_name)
    const thumbnailUrl = await s3Retrieve(thumbnail_name)

    const { view_count, like_count, comments_count } = await getPostStats(parseInt(postId))

    const liked = await checkLike(parseInt(postId), parseInt(req.query.user_id))
    
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
    console.error(err.message)
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