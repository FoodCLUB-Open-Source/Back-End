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

/* Change password */

router.post('/changepassword', rateLimiter(10, 1), async (req, res) => {

  var cognitoUser = userPool.getCurrentUser()  

  cognitoUser.getSession((err, session) => {
    if (err) {
      res.status(400).json(err.message)
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