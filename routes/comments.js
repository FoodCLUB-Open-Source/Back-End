const express = require("express")
const router = express.Router()

const { setComment, setReplies } = require("../dynamo_schemas/dynamo_schemas")
const { getItemPartitionKey, putItem, updateItem, deleteItem } = require('../functions/dynamoDB_functions');
const { } = require('../functions/validators/comments_validators')
const { requestLimiter } = require('../functions/general_functions')


/* Testing Posts Route */
router.get("/testing", async (req, res) => {
	try {
	  
	  res.json({ "Testing": "Working Comments" })
	} catch (err) {
	  console.error(err.message)
	}
})


/* Posting Comment For Specific Post */
router.post("/posts/comments/:id", requestLimiter,  async (req, res, next) => {
	try {

		const postId = parseInt(req.params.id)
		const { user_id, comment } = req.body

		const commentSchema = setComment(user_id, postId, comment)

		await putItem("Comments", commentSchema)

		const params = {
			TableName: 'Post_Stats',
			Key: {
			  'post_id': postId,
			},
			UpdateExpression: 'set comments_count = comments_count + :val',
			ExpressionAttributeValues: {
			  ':val': 1
			},
			ReturnValues: 'UPDATED_NEW'
		};

		await updateItem(params)

		console.log("Comment Posted")
		res.json({ "Status": "Comment Posted" })
		
	} catch (err) {
		next(err)
	}
})



















/* Getting 30 most liked Comments For Specific Post */
router.get("/posts/comments/:id", requestLimiter, async (req, res, next) => {
	try {
		const postId = parseInt(req.params.id)
		
		const params = {
			TableName: "Comments",
			IndexName: "post_id_comment_like_count_index",
			KeyConditionExpression: "#pid = :pid",
			ExpressionAttributeNames: {
				"#pid": "post_id",
			},
			ExpressionAttributeValues: {
				":pid": postId,
			},
			ScanIndexForward: false, // to sort in descending order
			Limit: 30
		};
		
		//return the user details aswell
		//maybe make it so that the user that is requesting the comments. his comments are first.
		const results = await getItemPartitionKey(params)

		console.log(results)

		console.log("Comments Fetched")
		res.json({ "Testing": "Working Posts", "Results": results })
  
	} catch (err) {
	  next(err)
	}
})


/* Update Comment For Specific Post */ 
router.put("/posts/comments/:id", requestLimiter, async (req, res, next) => {
	try {

		const commentId = req.params.id
		const { comment, post_id } = req.body


		const params = {
			TableName: "Comments",
			Key: {
				"post_id": post_id,
				"comment_id": commentId
			},
			UpdateExpression: "set #cmt = :c, updated_at = :u",
			ExpressionAttributeNames: {
				"#cmt": "comment"
			},
			ExpressionAttributeValues: {
				":c": comment,
				":u": new Date().toISOString()
			},
			ReturnValues: "UPDATED_NEW"
		};

		await updateItem(params)

		console.log("Comment Updated")
		res.json({ Status: "Comment Updated" })
		
	} catch (err) {
		next(err)
	}
})

/* Delete Comment For Specific Post */
router.delete("/posts/comments/:id", requestLimiter, async (req, res, next) => {
	try {

		let commentId = req.params.id
		let { post_id } = req.body
		post_id = parseInt(post_id)

		let params = {
			TableName: "Comments",
			Key: {
				post_id: post_id, 
				comment_id: commentId
			}
		}
		
		await deleteItem(params)

		params = {
			TableName: 'Post_Stats',
			Key: {
			  'post_id': post_id,
			},
			UpdateExpression: 'set comments_count = comments_count - :val',
			ExpressionAttributeValues: {
			  ':val': 1
			},
			ReturnValues: 'UPDATED_NEW'
		};

		await updateItem(params)

		console.log("Comment Deleted")
		res.json({ Status: "Comment Deleted" })

	} catch (err) {
		next(err)
	}
})


/* get 20 Replies For Specific Comment */
router.get("/posts/comments/replies/:id", requestLimiter,  async (req, res, next) => {
	try {

		const commentId = req.params.id

		const params = {
			TableName: "Replies",
			IndexName: "comment_id-created_at-index",
			KeyConditionExpression: "#cid = :cid",
			ExpressionAttributeNames: {
				"#cid": "comment_id",
			},
			ExpressionAttributeValues: {
				":cid": commentId,
			},
			ScanIndexForward: false, // to sort in descending order
			Limit: 20
		};
		
		//return the user details aswell
		//maybe make it so that the user that is requesting the comments. his comments are first.


		const results = await getItemPartitionKey(params)

		console.log("Comments Fetched")
		res.json({ "Testing": "Working Posts", "Results": results })


	} catch (err) {
		next(err)
	}
})

/* Posting Reply For Specific Comment */
router.post("/posts/comments/replies/:id", requestLimiter,  async (req, res, next) => {
	try {

		let commentId = req.params.id
		const { user_id, post_id, reply } = req.body

		const replySchema = setReplies(user_id, commentId, reply)

		await putItem("Replies", replySchema)
		
		const params = {
			TableName: 'Comments',
			Key: {
			  'post_id': post_id,
			  'comment_id': commentId
			},
			UpdateExpression: 'set comment_reply_count = comment_reply_count + :val',
			ExpressionAttributeValues: {
			  ':val': 1
			},
			ReturnValues: 'UPDATED_NEW'
		};

		await updateItem(params)

		console.log("Reply Posted")
		res.json({ "Status": "Reply Posted" })

	} catch (err) {
		next(err)
	}
})

/* update Reply For Specific Comment */
router.put("/posts/comments/replies/:id", requestLimiter,  async (req, res, next) => {
	try {

		const replyId = req.params.id
		const { reply, comment_id } = req.body

		const params = {
			TableName: "Replies",
			Key: {
				"comment_id": comment_id,
				"reply_id": replyId
			},
			UpdateExpression: "set #rply = :r, updated_at = :u",
			ExpressionAttributeNames: {
				"#rply": "reply"
			},
			ExpressionAttributeValues: {
				":r": reply,
				":u": new Date().toISOString()
			},
			ReturnValues: "UPDATED_NEW"
		};

		await updateItem(params)

		console.log("Reply Updated")
		res.json({ Status: "Reply Updated" })


	} catch (err) {
		next(err)
	}
})

/* Delete Reply For Specific Comment */
router.delete("/posts/comments/replies/:id", requestLimiter,  async (req, res, next) => {
	try {

		let replyId = req.params.id
		const { comment_id, post_id } = req.body

		console.log(comment_id, post_id, replyId)
		let params = {
			TableName: "Replies",
			Key: {
				comment_id: comment_id, 
				reply_id: replyId
			}
		}
		
		await deleteItem(params)

		params = {
			TableName: 'Comments',
			Key: {
			  'post_id': post_id,
			  'comment_id': comment_id
			},
			UpdateExpression: 'set comment_reply_count = comment_reply_count - :val',
			ExpressionAttributeValues: {
			  ':val': 1
			},
			ReturnValues: 'UPDATED_NEW'
		};

		await updateItem(params)

		console.log("Reply Deleted")
		res.json({ Status: "Reply Deleted" })

	} catch (err) {
		next(err)
	}
})

  module.exports = router;