/* For login system routes */

const express = require("express");
const router = express.Router();
const bodyParser = require('body-parser');
const http = require("http");
const { pgQuery } = require("../functions/general_functions");
const AmazonCognitoId = require("amazon-cognito-identity-js");
const AWS = require('aws-sdk');

const crypto = require('crypto')
const bcrypt = require('bcrypt')
const appFunctions = require('../functions/general_functions')
const rateLimiter = require('../middleware/rate_limiter')

const poolData = {
  UserPoolId: "eu-west-2_KdYKyXzvR",
  ClientId: "3oga7396va7mjl4qsemqk0at7u"
};

const pool_region = "eu-west-2";

const userPool = new AmazonCognitoId.CognitoUserPool(poolData);

router.use(bodyParser.urlencoded({ extended: false }))

/* Testing Login Route */
router.get("/testing", async (req, res) => {
  try {
    res.json({ "Testing": "Working Login" });
  } catch (err) {
    console.error(err.message);
    res.json(err.message)
  }
});

/* Sign up */ 

router.post('/signup', rateLimiter(10, 1), async (req, res) => {
  const { username, email, password } = req.body;
  

  if (!(username && email && password)) {
    return res.status(400).json({ message :"Necessary input fields not given." });
  };

  var attributeArray = [];
  const passwordHashed = await bcrypt.hash(password)
  const dateOfBirth = "01/01/2000"

  /* aws cognito assigns a UUID value to each user's sub attribute */
  attributeArray.push(new AmazonCognitoId.CognitoUserAttribute({ Name: "email", Value: email }));

  userPool.signUp(username, password, attributeArray, null, async (err, result) => {
    if (err) {
      console.error(err);
      return res.status(400).json({message: err.message});
    }
    try {
      const newUser = await appFunctions.pgQuery(`INSERT INTO users (username, email, password, date_of_birth) VALUES ($1, $2, $3, $4) RETURNING *`,
      username, email, passwordHashed, dateOfBirth);
    } catch (error) {
      return res.status(400).json(error.message)
    }
    return res.status(201).json({user: result.user});
  });  
})



module.exports = router;