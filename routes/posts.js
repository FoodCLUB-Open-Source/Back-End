/* For video/image posting routes */

const express = require("express");
const router = express.Router();

/* Testing Posts Route */
router.get("/testing", async (req, res) => {
  try {
    res.json({ "Testing": "Working Posts" });
  } catch (err) {
    console.error(err.message);
  }
});


module.exports = router;