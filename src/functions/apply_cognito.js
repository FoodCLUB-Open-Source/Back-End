import { CognitoUser, CognitoUserAttribute } from "amazon-cognito-identity-js";
import { cognitoUserPool } from "../config/cognito.js";
/**  
 * This file holds functions (not middleware) that may need to be used in other backend microservices.
*/

/** This function updates a cognito attribute. It is to be called whenever email or username are
 * changed in the PostgreSQL.
*/

export const changeAttribute = (attributeName, attributeValue) => {

  const cognitoUser = cognitoUserPool.getCurrentUser();

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
    return `user ${username}'s ${attributeName} was updated successfully to ${attributeValue}`
  });
}

/**
 * This function is used to get the current user from their stored jwt tokens.
 * Internally, the functions called within here will perform tasks that would be
 * performed separately, all together.
*/ 

export const getUserFromTokens = async (callback) => {
  const cognitoUser = cognitoUserPool.getCurrentUser();
  
  if (cognitoUser != null) {
    cognitoUser.getSession((err, session) => {
      if (err) {
        return callback(
          err,
          null
        );
      } else {
        return callback(
          null,
          cognitoUser
        )
      }
    });
  } else {
    return callback({
      header: 'session not found',
      message: 'user is not authenticated'
    }, 
    null)
  }
}
