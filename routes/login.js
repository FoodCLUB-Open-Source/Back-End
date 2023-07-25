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

const CognitoUserPool = AmazonCognitoId.CognitoUserPool;

const poolData = {
  UserPoolId: "eu-west-2_CJCWF6vna",
  ClientId: "6ttdjdp51nocb2jn1it280squl"
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
  const { username, email, phoneNumber, profilePicture, userBio, gender, dateOfBirth, password } = req.body;
  

  if (!(username && email && dateOfBirth && password)) {
    return res.status(400).json({ message :"Necessary input fields not given." });
  };

  var attributeArray = [];

  /* aws cognito assigns a UUID value to each user's sub attribute */
  attributeArray.push(new AmazonCognitoId.CognitoUserAttribute({ Name: "email", Value: email }));
  attributeArray.push(new AmazonCognitoId.CognitoUserAttribute({ Name: "phone_number", Value: phoneNumber }));  

  userPool.signUp(username, password, attributeArray, null, async (err, result) => {
    if (err) {
      console.error(err);
      return res.status(400).json({message: err.message});
    }
    const newUser = await appFunctions.pgQuery(`INSERT INTO users (username, email, phone_number, profile_picture, user_bio, gender, created_at, updated_at, date_of_birth) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    username, email, phoneNumber, profilePicture, userBio, gender, new Date(), new Date(), dateOfBirth);
    return res.status(201).json({user: result.user});
  });  
})

module.exports = router;