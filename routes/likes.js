const express = require("express")
const router = express.Router()

const { setComment, setCommentsLike } = require("../dynamo_schemas/dynamo_schemas")
const { getItemPrimaryKey, getItemPartitionKey, putItem } = require('../functions/dynamoDB_functions');


/* Testing Posts Route */
router.get("/testing", async (req, res) => {
	try {
  
	  const params = {
		TableName: "Views",
		Key: {
		  post_id:1,
		  view_id:"asda"
		}
	  };
	  
	  const results = await getItemPrimaryKey(params)
  
	  const adding = {
		post_id: 2,
		view_id: "practise",
		message: "THIS IS ADDED THROUGH NODE.JS"
	  }
	  await putItem("Views", adding)
	  
	  res.json({ "Testing": "Working Posts", "Results": results })
	} catch (err) {
	  console.error(err.message)
	}
  })

  
/* Posting For Liking Specific Video */
router.post("/homepage/postlike", async (req, res) => {
	try {
  
   
	} catch (err) {
	  console.error(err.message)
	}
  })
  
  /* Deleting Like On Specific Video */
  router.delete("/homepage/deletelike", async (req, res) => {
	try {
  
   
	} catch (err) {
	  console.error(err.message)
	}
  })

  module.exports = router;