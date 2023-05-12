const express = require("express")
const router = express.Router()

const { setCommentsLike } = require("../dynamo_schemas/dynamo_schemas")
const { getItemPrimaryKey, getItemPartitionKey, putItem } = require('../functions/dynamoDB_functions');


/* Testing Posts Route */
router.get("/testing", async (req, res) => {
	try {
		
		res.json({ "Testing": "Working Posts" })
	} catch (err) {
		console.error(err.message)
	}
})

  
/* Posting For Liking Specific Video */
router.post("/postlike", async (req, res) => {
	try {


	} catch (err) {
		console.error(err.message)
	}
})
  
  /* Deleting Like On Specific Video */
router.delete("/deletelike", async (req, res) => {
	try {


	} catch (err) {
		console.error(err.message)
	}
})

  router.post("/postcommentlike", async (req, res) => {
	try {
		const {user_id, comment_id} = req.body
		
		const commentLikeSchema = setCommentsLike(user_id, comment_id)
	
		await putItem("Comment_Likes", commentLikeSchema)
	
		res.json({ "Status": "Comment Liked"})
	
	} catch (err) {
		console.error(err.message)
	}
})

  module.exports = router;