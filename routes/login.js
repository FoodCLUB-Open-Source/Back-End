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
  }
});

/* Sign up */ 

router.post('/signup', async (req, res) => {
  var { user_id, username, email, phone_number, profilePicture, user_bio, gender, date_of_birth, password } = req.body;
  

  if (!(username && email && date_of_birth && password)) {
    res.status(400).json({ message :"Necessary input fields not given." });
  };
  
  var user_created_at_psql = new Date();
  var user_updated_at_psql = user_created_at_psql;

  var attributeArray = [];

  /* aws cognito assigns a UUID value to each user's sub attribute */
  attributeArray.push(new AmazonCognitoId.CognitoUserAttribute({ Name: "email", Value: email }));
  attributeArray.push(new AmazonCognitoId.CognitoUserAttribute({ Name: "phone_number", Value: phone_number }));
  attributeArray.push(new AmazonCognitoId.CognitoUserAttribute({ Name: "birthdate", Value: date_of_birth }));

  var newUser = await appFunctions.pgQuery(`INSERT INTO users (username, email, phone_number, profile_picture, user_bio, gender, created_at, updated_at, date_of_birth) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
  username, email, phone_number, profilePicture, user_bio, gender, user_created_at_psql, user_updated_at_psql, date_of_birth);

  userPool.signUp(username, password, attributeArray, null, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(400).json({message: err.message});
    }
    cognitoUser = result.user;
    return res.status(201).json({user: cognitoUser});
  });  

})

module.exports = router;