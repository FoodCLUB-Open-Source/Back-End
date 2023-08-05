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

const poolData = {
  UserPoolId: process.env.USER_POOL_ID,
  ClientId: process.env.CLIENTID
};


const userPool = new AmazonCognitoId.CognitoUserPool(poolData);

/* Testing Login Route */
router.get("/testing", async (req, res) => {
  try {
    res.json({ "Testing": "Working Login" });
  } catch (err) {
    console.error(err.message);
    res.json(err.message)
  }
});

/* Sign in */

router.post('/signin', (req, res) => {
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
