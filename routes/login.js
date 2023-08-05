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
  UserPoolId: process.env.USER_POOL_ID,
  ClientId: process.env.CLIENT_ID
};

const userPool = new AmazonCognitoId.CognitoUserPool(poolData);

/* Sign out of application*/

router.post('/signout', rateLimiter(10,1), (req, res) => {

  const cognitoUser = userPool.getCurrentUser()

  if (cognitoUser != null) {
    cognitoUser.signOut();
    res.status(200).json({message: 'user successfully logged out'});
  } else {
    res.status(500).json({message: 'cannot log user out'});
  };
})

module.exports = router;