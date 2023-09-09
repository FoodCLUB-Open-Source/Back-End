import { CognitoUser, CognitoUserAttribute } from "amazon-cognito-identity-js";
import cognitoUserPool from "../config/cognito";
/* 
This file holds functions (not middleware) that may need to be used in other backend microservices.
*/

/* This function updates a cognito attribute. It is to be called whenever email or username are
changed in the PostgreSQL */

const changeAttribute = (attributeName, attributeValue) => {
  const userData = {
    Username: username,
    Pool: cognitoUserPool,
  };

  const cognitoUser = new CognitoUser(userData);

  const attributeList = [];
  
  const newAttribute = {
    Name: attributeName,
    Value: attributeValue,
  };

  attributeList.push(new CognitoUserAttribute(newAttribute));

  cognitoUser.updateAttributes(attributeList, (err, result) => {
    if (err) {
      return res.status(401).json(err.message);
    }
    return res.status(200).json({message: `user ${username}'s ${attributeName} was updated successfully to ${attributeValue}`})
  });
}