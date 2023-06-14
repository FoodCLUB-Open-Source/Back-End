const express = require("express")
const router = express.Router()

const { putItem, updateItem, deleteItem } = require('../functions/dynamoDB_functions');
const { setLikes, setViews, setCommentsLike } = require("../dynamo_schemas/dynamo_schemas")
const { requestLimiter } = require('../functions/general_functions')
const { validatePostView, validatePostLike, validateDeleteLike, validatePostComment, validateDeleteComment } = require('../functions/validators/like_view_validator')
const { validationResult } = require('express-validator')

/* Testing Posts Route */
router.get("/testing", async (req, res) => {
	try {
		
		res.json({ "Testing": "Working Posts" })
	} catch (err) {
		console.error(err.message)
	}
})

/* Posting For Viewing Specific Video */
router.post("/posts/view/:id", requestLimiter, validatePostView(), async (req, res, next) => {
	try {

		const errors = validationResult(req)
  
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() })
		}

		const postId = parseInt(req.params.id)
		const { user_id } = req.body

		const viewSchema = setViews(parseInt(user_id), postId)
		
		const params = {
			TableName: 'Post_Stats',
			Key: {
			  'post_id': postId,
			},
			UpdateExpression: 'set view_count = view_count + :val',
			ExpressionAttributeValues: {
				':val': 1
			},
			ReturnValues: 'UPDATED_NEW'
		};
		
		await Promise.all([
			putItem("Views", viewSchema),
			updateItem(params)
		])
		
		console.log("Post Viewed")
		res.json({ Status: "Post Viewed" })
	} catch (err) {
		next(err)
	}
})

/* Posting For Liking Specific Video */
router.post("/posts/like/:id", requestLimiter, validatePostLike(), async (req, res, next) => {
	try {

		const errors = validationResult(req)
  
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() })
		}

		const postId = parseInt(req.params.id)
		const { user_id } = req.body

		const likeSchema = setLikes(parseInt(user_id), postId)
		
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
		
		await Promise.all([
			putItem("Likes", likeSchema),
			updateItem(params)
		])
		
		console.log("Post Liked")
		res.json({ Status: "Post Likes" })

	} catch (err) {
		next(err)
	}
})

/* Deleting Like On Specific Video */
router.delete("/posts/like/:id", requestLimiter, validateDeleteLike(), async (req, res, next) => {
	try {

		const errors = validationResult(req)
  
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() })
		}

		const postId = parseInt(req.params.id)
		const { user_id } = req.body

		
		const deleteParams = {
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
		
		const updateParams = {
			TableName: "Likes",
			Key: {
				post_id: postId,
				user_id: parseInt(user_id)
			}
		}
		await Promise.all([
			updateItem(deleteParams),
			deleteItem(updateParams)
		])

		console.log("Post Unliked")
		res.json({ Status: "Post Unliked" })

	} catch (err) {
		next(err)
	}
})

/* Posting a like for a specific comment */
router.post("/posts/comment/like/:id", requestLimiter, validatePostComment(), async (req, res, next) => {
	try {

		const errors = validationResult(req)
  
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() })
		}

		const commentId = req.params.id
		const { user_id, post_id } = req.body

		const commentLikeSchema = setCommentsLike(parseInt(user_id), commentId)
	
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
		
		await Promise.all([
			putItem("Comment_Likes", commentLikeSchema),
			updateItem(params)
		])

		res.json({ "Status": "Comment Liked" })

	} catch (err) {
		next(err)
	}
})

/* Deleting Like On Specific Comment */
router.delete("/posts/comment/like/:id", requestLimiter, validateDeleteComment(), async (req, res, next) => {
	try {

		const commentId = req.params.id
		const { comment_like_id, post_id } = req.body

		const deleteParams = {
			TableName: "Comment_Likes",
			Key: {
				comment_id: commentId,
				comment_like_id: comment_like_id
			}
		}
		
		const updateParams = {
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
		
		await Promise.all([
			deleteItem(deleteParams),
			updateItem(updateParams)
		])

		console.log("Comment Unliked")
		res.json({ Status: "Comment Unliked" })

	} catch (err) {
		next(err)
	}
})

module.exports = router;