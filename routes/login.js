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
  UserPoolId: process.env.USER_POOL_ID,
  ClientId: process.env.CLIENT_ID
};

const userPool = new AmazonCognitoId.CognitoUserPool(poolData);

/* Change password */

router.post('/changepassword', rateLimiter(10, 1), async (req, res) => {

  const cognitoUser = userPool.getCurrentUser()  

  cognitoUser.getSession((err, session) => {
    if (err) {
      return res.status(400).json(err.message)
    }
  });

  cognitoUser.changePassword(req.body.oldPassword, req.body.newPassword, (err, result) => {
    if (err) {
      return res.status(400).json(err.message);
    }
    return res.status(201).json({ message: 'password changed successfully' });
  });
  

})

module.exports = router;