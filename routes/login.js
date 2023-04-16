/* For login system routes */

const express = require("express");
const router = express.Router();

/* Testing Login Route */
router.get("/testing", async (req, res) => {
  try {
    res.json({ "Testing": "Working Login" });
  } catch (err) {
    console.error(err.message);
  }
});


module.exports = router;