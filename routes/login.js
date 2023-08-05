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

/* Testing Login Route */
router.get("/testing", async (req, res) => {
  try {
    res.json({ "Testing": "Working Login" });
  } catch (err) {
    console.error(err.message);
  }
});

/* Confirm verification code */
router.post('/confirmverification', rateLimiter(10, 1), (req, res) => {
  var userData = {
    Username: req.body.username,
    Pool: userPool,
  };

  var cognitoUser = new AmazonCognitoId.CognitoUser(userData);

  cognitoUser.confirmRegistration(req.body.verificationCode, true, (err, result) => {
    if (err) {
      return res.status(400).json(err.message)
    }
    return res.status(201).json({message: 'user verified'})
  });
})

/* Resend Verification Code */
router.post('/resendverificationcode', rateLimiter(10, 1), (req, res) => {
  var userData = {
    Username: req.body.username,
    Pool: userPool,
  };

  var cognitoUser = new AmazonCognitoId.CognitoUser(userData);

  cognitoUser.resendConfirmationCode((err, result) => {
    if (err) {
      return res.status(400).json(err.message)
    }
    res.status(200).json({ message: 'new code sent successfully' })
  });
})



module.exports = router;