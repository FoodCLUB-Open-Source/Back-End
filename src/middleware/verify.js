import { CognitoAccessToken, CognitoIdToken } from "amazon-cognito-identity-js"
import { accessVerifier, idVerifier }from "../cognito.js";
import { parseHeader, parseHeaderAccess } from "../functions/cognito_functions.js";

// All tokens should be passed from frontend and stored as strings, not as objects.
// Verifier that expects valid access tokens:
/**
 * INTERNAL USE ONLY
 * @param {*} accessToken 
 * @returns 
 */

export const verifyAccessToken = async (accessToken) => {

  if (!!accessToken) {
    try {
      const cognitoAccessToken = new CognitoAccessToken(accessToken);
      await accessVerifier.verify(
        cognitoAccessToken.getJwtToken()
      );
    } catch {
      // If the access token is not valid, the refresh token will be validated. 
      return new Error({
        header: 'Access token invalid',
        message: 'Session refresh required'
      });
    };
  } else {
    return new Error({message: 'Access token is null'});
  };
};

// Function to verify Id token
/** INTERNAL USE ONLY
 * 
 * @param {*} idToken 
 * @returns 
 */

export const verifyIdToken = async (idToken) => {

  if (!!idToken) {
    const cognitoIdToken = new CognitoIdToken(idToken)
    try {
      const payload = await idVerifier.verify(
        cognitoIdToken.getJwtToken()
      );
      return {
        user_id: payload['custom:id'],
        username: payload['cognito:username']
      };
    } catch {
      return new Error({ 
        header: "ID token invalid",
        message: "Session refresh required"
      });
    }
  } else {
    return res.status(400).json({
      message: "ID token is null"
    })
  }
}


/**
 * Middleware for verification of both access and id tokens, to be used with endpoints that accept both.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
export const verifyTokens = async (req, res, next) => {
  try {
    const authorisation = req.header['Authorisation'];
    const { access_token, id_token } = parseHeader(authorisation);
    await verifyAccessToken(access_token);
    req.body.payload = await verifyIdToken(id_token);
    next()
  } catch (error) {
    res.status(400).json({ message: error.message });
  };
};

/**
 * Middleware for authenticating only the access token, for endpoints that only require the access token.
 * Endpoints that only require the access token will be endpoints that do not require any user information.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
export const verifyAccessOnly = async (req, res, next) => {
  try {
    const authorisation = req.header['Authorisation'];
    const { access_token } = parseHeaderAccess(authorisation);
    await verifyAccessToken(access_token)
    next()
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}