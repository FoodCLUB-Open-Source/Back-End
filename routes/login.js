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

/* Sign in */

router.post('/signin', (req, res) => {
  var username = req.body.username;
  
  var authenticationDetails = new AmazonCognitoId.AuthenticationDetails({
    Username: username,
    Password: req.body.password
  });

  var userData = {
    Username: username,
    Pool: userPool
  };

  var cognitoUser = new AmazonCognitoId.CognitoUser(userData);
  
  cognitoUser.authenticateUser(authenticationDetails, {
    onSuccess: (result) =>{
      var idToken = result.getIdToken().getJwtToken();
      var accessToken = result.getAccessToken().getJwtToken();
      var refreshToken = result.getRefreshToken().getToken();
      res.status(200).json({ message: 'user authenticated successfully' });
      AWS.config.region = pool_region;
    },
    onFailure: (err) => {
      res.status(400).json({
        header: 'incorrect sign-in details',
        message: err.message});
    }
  });  
});

module.exports = router
