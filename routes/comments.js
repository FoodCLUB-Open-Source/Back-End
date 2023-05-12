const express = require("express")
const router = express.Router()

const { setComment, setCommentsLike } = require("../dynamo_schemas/dynamo_schemas")
const { getItemPrimaryKey, getItemPartitionKey, putItem } = require('../functions/dynamoDB_functions');


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

		res.json({ "Status": "Comment Posted" })
		
	} catch (err) {
		console.error(err.message)
	}
})














/* Getting 50 most liked Comments For Specific Post */
router.get("/getcomments/:id", async (req, res) => {
	try {
	  const postId = parseInt(req.params.id)
	  
	  const params = {
		TableName: "Comments",
		KeyConditionExpression: "post_id = :postId",
		ExpressionAttributeValues: {
		  ":postId": postId
		},
	  }
  
	  const results = await getItemPartitionKey(params)
	  
	  res.json({ "Testing": "Working Posts", "Results": results })
  
	} catch (err) {
	  console.error(err.message)
	}
  })











/* Delete Comment For Specific Post */
router.put("/updatecomment/:id", async (req, res) => {
	try {

		
	} catch (err) {
		console.error(err.message)
	}
})

/* Delete Comment For Specific Post */
router.delete("/deletecomment", async (req, res) => {
	try {

		
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