const express = require("express")
const router = express.Router()

const { setComment } = require("../dynamo_schemas/dynamo_schemas")
const { getItemPrimaryKey, getItemPartitionKey, putItem, updateItem, deleteItem } = require('../functions/dynamoDB_functions');


/* Testing Posts Route */
router.get("/testing", async (req, res) => {
	try {
	  
	  res.json({ "Testing": "Working Comments" })
	} catch (err) {
	  console.error(err.message)
	}
})

/* Posting Comment For Specific Post */
router.post("/postcomment", async (req, res) => {
	try {

		const { user_id, post_id, comment } = req.body

		const commentSchema = setComment(user_id, post_id, comment)

		await putItem("Comments", commentSchema)

		const params = {
			TableName: 'Post_Stats',
			Key: {
			  'post_id': post_id,
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
		console.error(err.message)
	}
})


/* Getting 30 most liked Comments For Specific Post */
router.get("/getcomments/:id", async (req, res) => {
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
		
		//maybe make it so that the user that is requesting the comments. his comments are first.
		

		const results = await getItemPartitionKey(params)

		console.log("Comments Fetched")
		res.json({ "Testing": "Working Posts", "Results": results })
  
	} catch (err) {
	  console.error(err.message)
	}
  })


/* Update Comment For Specific Post */
router.put("/updatecomment/:id", async (req, res) => {
	try {

		const postId = parseInt(req.params.id)
		const { comment, comment_id } = req.body

		console.log(postId, comment, comment_id)

		const params = {
			TableName: "Comments",
			Key: {
				"post_id": postId,
				"comment_id": comment_id
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
		console.error(err.message)
	}
})

/* Delete Comment For Specific Post */
router.delete("/deletecomment/:id", async (req, res) => {
	try {

		let postId = parseInt(req.params.id)

		let params = {
			TableName: "Comments",
			Key: {
				post_id: postId, 
				comment_id: req.query.comment_id
			}
		}
		
		await deleteItem(params)

		params = {
			TableName: 'Post_Stats',
			Key: {
			  'post_id': postId,
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
		console.error(err.message)
	}
})


/* Posting Reply For Specific Comment */
router.get("/postreply", async (req, res) => {
	try {


	} catch (err) {
		console.error(err.message)
	}
})



/* Delete Reply For Specific Comment */
router.delete("/deletereply", async (req, res) => {
	try {


	} catch (err) {
		console.error(err.message)
	}
})

  module.exports = router;