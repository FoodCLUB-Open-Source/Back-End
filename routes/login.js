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

/* Sign out of application*/

router.post('/signout', rateLimiter(10,1), (req, res) => {

  var cognitoUser = userPool.getCurrentUser()

  if (cognitoUser != null) {
    cognitoUser.signOut();
    res.status(200).json({message: 'user successfully logged out'});
  } else {
    res.status(500).json({message: 'cannot log user out'});
  };
})

module.exports = router;