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
router.post("/postlike/:id", async (req, res) => {
	try {

		const postId = parseInt(req.params.id)
		const { user_id } = req.body

		const likeSchema = setLikes(user_id, postId)
		await putItem("Likes", likeSchema)

		const params = {
			TableName: 'Post_Stats',
			Key: {
			  'post_id': postId,
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
router.delete("/deletelike/:id", async (req, res) => {
	try {

		const postId = parseInt(req.params.id)
		const { user_id } = req.body

		let params = {
			TableName: "Likes",
			Key: {
				post_id: postId,
				user_id: user_id
			}
		}
	
	  	await deleteItem(params)

		params = {
			TableName: 'Post_Stats',
			Key: {
			  'post_id': postId,
			},
			UpdateExpression: 'set like_count = like_count - :val',
			ExpressionAttributeValues: {
			  ':val': 1
			},
			ReturnValues: 'UPDATED_NEW'
		};

		await updateItem(params)

		console.log("Post Unliked")
		res.json({Status: "Post Unliked"})

	} catch (err) {
		console.error(err.message)
	}
})

/* Posting a like for a specific comment */
router.post("/postcommentlike/:id", async (req, res) => {
	try {

		const commentId = req.params.id
		const { user_id, post_id } = req.body
		
		console.log(commentId, user_id, post_id)

		const commentLikeSchema = setCommentsLike(user_id, commentId)

		await putItem("Comment_Likes", commentLikeSchema)

		params = {
			TableName: 'Comments',
			Key: {
			  'post_id': parseInt(post_id),
			  'comment_id': commentId
			},
			UpdateExpression: 'set comment_like_count = comment_like_count + :val',
			ExpressionAttributeValues: {
			  ':val': 1
			},
			ReturnValues: 'UPDATED_NEW'
		};

		await updateItem(params)


		res.json({ "Status": "Comment Liked"})

	} catch (err) {
		console.error(err.message)
	}
})

/* Deleting Like On Specific Comment */
router.delete("/deletecommentlike/:id", async (req, res) => {
	try {

		const commentId = req.params.id
		const { comment_like_id, post_id } = req.body

		console.log(commentId, comment_like_id, post_id)

		let params = {
			TableName: "Comment_Likes",
			Key: {
				comment_id: commentId,
				comment_like_id: comment_like_id
			}
		}
	
	  	await deleteItem(params)

		params = {
			TableName: 'Comments',
			Key: {
			  'post_id': parseInt(post_id),
			  'comment_id': commentId
			},
			UpdateExpression: 'set comment_like_count = comment_like_count - :val',
			ExpressionAttributeValues: {
			  ':val': 1
			},
			ReturnValues: 'UPDATED_NEW'
		};

		await updateItem(params)

		console.log("Comment Unliked")
		res.json({Status: "Comment Unliked"})

	} catch (err) {
		console.error(err.message)
	}
})

  module.exports = router;