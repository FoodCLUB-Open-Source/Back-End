/* Cognito User Pool Connection */
import { CognitoUserPool } from "amazon-cognito-identity-js";
import { CognitoJwtVerifier } from "aws-jwt-verify";

export const poolData = {
  UserPoolId: process.env.USER_POOL_ID,
  ClientId: process.env.CLIENT_ID
};

export const cognitoUserPool = new CognitoUserPool(poolData);

export const accessVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID,
  tokenUse: "access",
  clientId: process.env.CLIENT_ID,
});

export const idVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID,
  tokenUse: "id",
  clientId: process.env.CLIENT_ID,
});
