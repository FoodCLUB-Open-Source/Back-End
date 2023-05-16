const express = require("express")
const router = express.Router()

const { setCommentsLike } = require("../dynamo_schemas/dynamo_schemas")
const { putItem, updateItem, deleteItem } = require('../functions/dynamoDB_functions');
const { setLikes } = require("../dynamo_schemas/dynamo_schemas")

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
		const { user_id, post_id } = req.body

		const likeSchema = setLikes(user_id, post_id)
		await putItem("Likes", likeSchema)

		const params = {
			TableName: 'Total_Likes',
			Key: {
			  'post_id': post_id,
			},
			UpdateExpression: 'set like_count = like_count + :val',
			ExpressionAttributeValues: {
			  ':val': 1
			},
			ReturnValues: 'UPDATED_NEW'
		};

		await updateItem(params)
		
		console.log("Post Liked")
		res.json({Status: "Post Likes"})

	} catch (err) {
		console.error(err.message)
	}
})
  
/* Deleting Like On Specific Video */
router.delete("/deletelike", async (req, res) => {
	try {

		const { user_id, post_id } = req.body

		let params = {
			TableName: "Likes",
			Key: {
				post_id: post_id,
				user_id: user_id
			}
		}
	
	  	await deleteItem(params)

		params = {
			TableName: 'Total_Likes',
			Key: {
			  'post_id': post_id,
			},
			UpdateExpression: 'set like_count = like_count - :val',
			ExpressionAttributeValues: {
			  ':val': 1
			},
			ReturnValues: 'UPDATED_NEW'
		};

		await updateItem(params)

		console.log("Post Unliked")
		res.json({Status: "Post Unlike"})

	} catch (err) {
		console.error(err.message)
	}
})

/* Posting a like for a specific comment */
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

/* Deleting Like On Specific Comment */
router.delete("/deletecommentlike", async (req, res) => {
	try {


	} catch (err) {
		console.error(err.message)
	}
})

  module.exports = router;