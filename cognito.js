/* Cognito User Pool Connection */
const AmazonCognitoId = require("amazon-cognito-identity-js");

const poolData = {
  UserPoolId: process.env.USER_POOL_ID,
  ClientId: process.env.CLIENT_ID
};

const userPool = new AmazonCognitoId.CognitoUserPool(poolData);

module.export = {userPool, poolData}