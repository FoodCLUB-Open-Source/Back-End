import { CognitoUser, CognitoUserAttribute, CognitoAccessToken, CognitoIdToken, CognitoUserSession} from "amazon-cognito-identity-js";
import { cognitoUserPool } from "../config/cognito.js";
/**  
 * This file holds functions (not middleware) that may need to be used in other backend microservices.
*/

/** This function updates a cognito attribute. It is to be called whenever email or username are
 * changed in the PostgreSQL.
 * NEEDS ADDITION OF AUTHENTICATION BY TOKENS -id and access tokens needed.
*/

export const changeAttribute = (attributeName, attributeValue, req) => {
    
  const { username } = req.body.payload.username;
  
  const userData = {
    Username: username,
    Pool: cognitoUserPool,
  };
  
  // Get the authorisation header and tokens
  const authorisation = req.header['authorisation']
  try {
    const bearerTokens = parseHeader(authorisation)
    const access_token = bearerTokens.access_token;
    const id_token = bearerTokens.id_token;
    const cognitoAccessToken = new CognitoAccessToken({AccessToken: access_token})
    const cognitoIdToken = new CognitoIdToken({IdToken: id_token})
    
    const sessionData = {
      IdToken: cognitoIdToken,
      AccessToken: cognitoAccessToken,
      RefreshToken: null,
      ClockDrift: null,
    };
  
    const cognitoUserSession = new CognitoUserSession(sessionData);
  
    const cognitoUser = new CognitoUser(userData);
  
    cognitoUser.setSignInUserSession(cognitoUserSession);

    const attributeList = [];
    
    const newAttribute = {
      Name: attributeName,
      Value: attributeValue,
    };

    attributeList.push(new CognitoUserAttribute(newAttribute));

    cognitoUser.updateAttributes(attributeList, (err, result) => {
      if (err) {
        throw new Error(err.message);
      }
      return `user ${username}'s ${attributeName} was updated successfully to ${attributeValue}`;
    });
  } catch (error) {
    throw new Error(error.message) ;
  };
};


/** 
 * Function to parse the authorisation header for both id and access bearer tokens
 */

export const parseHeader = async (header) => {
  if (!!header && header.startsWith('Bearer ')) {
    const parseResult = header.split(' ');
    const access_token = parseResult[1];
    const id_token = parseResult[2];
    return {
      access_token: access_token,
      id_token: id_token
    };
  } else {
    throw new Error('Invalid request authorisation header')
  }
}

/**
 * Function to parse through the header when it only has the access token.
 * @param {*} header 
 * @returns 
 */

export const parseHeaderAccess = async (header) => {
  if (!!header && header.startsWith('Bearer ')) {
    const parseResult = header.split(' ');
    const access_token = parseResult[1];
    return {
      access_token: access_token,
    };
  } else {
    throw new Error('Invalid request authorisation header')
  }
}