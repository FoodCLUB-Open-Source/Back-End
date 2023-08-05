const express = require("express");
const router = express.Router();
const bodyParser = require('body-parser');
const http = require("http");
const { pgQuery } = require("../functions/general_functions");
const AmazonCognitoId = require("amazon-cognito-identity-js");
const AWS = require('aws-sdk/global');

const crypto = require('crypto')
const bcrypt = require('bcrypt')
const appFunctions = require('../functions/general_functions')
const rateLimiter = require('../middleware/rate_limiter')
const { userPool } = require('../cognito')

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

/* Confirm verification code */
router.post('/confirmverification', rateLimiter(10, 1), (req, res) => {
  const userData = {
    Username: req.body.username,
    Pool: userPool,
  };

  const cognitoUser = new AmazonCognitoId.CognitoUser(userData);

  cognitoUser.confirmRegistration(req.body.verificationCode, true, (err, result) => {
    if (err) {
      return res.status(400).json(err.message)
    }
    return res.status(201).json({message: 'user verified'})
  });
})

/* Resend Verification Code */
router.post('/resendverificationcode', rateLimiter(10, 1), (req, res) => {
  const userData = {
    Username: req.body.username,
    Pool: userPool,
  };

  const cognitoUser = new AmazonCognitoId.CognitoUser(userData);

  cognitoUser.resendConfirmationCode((err, result) => {
    if (err) {
      return res.status(400).json(err.message)
    }
    res.status(200).json({ message: 'new code sent successfully' })
  });
})

 /* Sign in */

router.post('/signin', rateLimiter(10,1), (req, res) => {
  const username = req.body.username;
  
  const authenticationDetails = new AmazonCognitoId.AuthenticationDetails({
    Username: username,
    Password: req.body.password
  });

  const userData = {
    Username: username,
    Pool: userPool
  };

  const cognitoUser = new AmazonCognitoId.CognitoUser(userData);
  
  cognitoUser.authenticateUser(authenticationDetails, {
    onSuccess: (result) =>{
      const idToken = result.getIdToken().getJwtToken();
      const accessToken = result.getAccessToken().getJwtToken();
      const refreshToken = result.getRefreshToken().getToken();
      user = pgQuery('SELECT id, username, profile_picture FROM users WHERE username = $1', username)
      res.status(200).json(user);
      AWS.config.region = pool_region;
    },
    onFailure: (err) => {
      res.status(400).json({
        header: 'sign in error',
        message: err.message});
    }
  });  
});

module.exports = router
