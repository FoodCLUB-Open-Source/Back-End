/* Cognito User Pool Connection */
import { CognitoUserPool } from "amazon-cognito-identity-js";

export const poolData = {
  UserPoolId: process.env.USER_POOL_ID,
  ClientId: process.env.CLIENT_ID
};

export const cognitoUserPool = new CognitoUserPool(poolData);