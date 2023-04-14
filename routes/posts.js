const express = require("express");
const router = express.Router();

router.get("/testing", async (req, res) => {
  try {
    res.json({ "Testing": "Working Posts" });
  } catch (err) {
    console.error(err.message);
  }
});

module.exports = router;