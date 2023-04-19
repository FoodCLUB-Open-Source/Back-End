/* For video/image posting routes */

const express = require("express")
const { pgQuery } = require('../functions/general_functions')

const router = express.Router()



/* Testing Posts Route */
router.get("/testing", async (req, res) => {
  try {
    const results = await pgQuery("SELECT * FROM users")
    console.log(results)
    res.json({ "Testing": "Working Posts", "Results": results.rows[0] })
  } catch (err) {
    console.error(err.message)
  }
})

                  /* Home Page Paths */

/* Get 15 random posts */
router.get("/homepage/getposts", async (req, res) => {
  try {

    const randomPosts = await pgQuery("SELECT * FROM posts ORDER BY RANDOM() LIMIT 15;")
    
    res.json({"posts": random.rows[0]})

  } catch (err) {
    console.error(err.message)
  }
})

/* Getting Ingredient For Specific Post */
router.get("/homepage/getingredients", async (req, res) => {
  try {

  } catch (err) {
    console.error(err.message)
  }
})

/* Getting Comments For Specific Post */
router.get("/homepage/getcomments", async (req, res) => {
  try {


  } catch (err) {
    console.error(err.message)
  }
})

/* Posting Message For Specific Post */
router.post("/homepage/postmessage", async (req, res) => {
  try {

   
  } catch (err) {
    console.error(err.message)
  }
})

/* Posting Reply For Specific Comment */
router.get("/homepage/postreply", async (req, res) => {
  try {

 
  } catch (err) {
    console.error(err.message)
  }
})

/* Delete Message For Specific Post */
router.delete("/homepage/deletemessage", async (req, res) => {
  try {

   
  } catch (err) {
    console.error(err.message)
  }
})

/* Delete Reply For Specific Comment */
router.delete("/homepage/deletereply", async (req, res) => {
  try {

 
  } catch (err) {
    console.error(err.message)
  }
})

/* Posting For Bookmarking Specific Post */
router.post("/homepage/postbookmark", async (req, res) => {
  try {

 
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

/* Posting For Sending Video To Friend */
router.post("/homepage/postsendvideo", async (req, res) => {
  try {

 
  } catch (err) {
    console.error(err.message)
  }
})

                /* Discover Page Paths */


module.exports = router;