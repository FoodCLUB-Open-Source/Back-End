import { CognitoAccessToken, CognitoIdToken } from "amazon-cognito-identity-js";
import { accessVerifier, idVerifier } from "../config/cognito.js";
import { parseHeader, parseHeaderAccess } from "../functions/cognito_functions.js";

// All tokens should be passed from frontend and stored as strings, not as objects.

/** 
 * Function that verifies access token
 * INTERNAL USE ONLY
 * 
 * @param {any} accessToken - Token to be verified by middleware
 * @throws {Error} - If access token is invalid or null
 */
export const verifyAccessToken = async (accessToken) => {

  if (accessToken) {
    try {
      const cognitoAccessToken = new CognitoAccessToken({ AccessToken: accessToken });
      await accessVerifier.verify(
        cognitoAccessToken.getJwtToken()
      );
    } catch (error) {
      // If the access token is not valid, the refresh token will be validated. 
      console.log("Access token invalid");
      throw new Error(error.message);
    }
  } else {
    console.log("access token null");
    throw new Error("Access token is null");
  }
};

/**
 * Function to verify Id token
 * INTERNAL USE ONLY
 * 
 * @param {any} idToken - ID token to be ferified 
 * @returns {object} - Object with user ID and username 
 * @throws {Error} - If ID token is null or invalid 
 */
export const verifyIdToken = async (idToken) => {

  if (idToken) {
    const cognitoIdToken = new CognitoIdToken({ IdToken: idToken });

    try {
      const payload = await idVerifier.verify(
        cognitoIdToken.getJwtToken()
      );
      return {
        user_id: payload["custom:id"],
        username: payload["cognito:username"]
      };
    } catch (error) {
      console.log("id token invalid");
      throw new Error(error.message);
    }
  } else {
    console.log("id token null");
    throw new Error("ID Token is null");
  }
};


/**
 * Middleware funciton for verification of both access and id tokens, to be used with endpoints that accept both
 * 
 * @param req 
 * @param res 
 * @param next 
 * @returns {status} - next() if successful, otherwise 404 with error message
 */
export const verifyTokens = async (req, res, next) => {
  try {
    const authorisation = req.headers["authorisation"];
    const bearerTokens = await parseHeader(authorisation);

    const access_token = bearerTokens.access_token;
    const id_token = bearerTokens.id_token;
    await verifyAccessToken(access_token);

    req.body.payload = await verifyIdToken(id_token);
    return next();
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
};

/**
 * Middleware function for authenticating only the access token, for endpoints that only require the access token
 * Endpoints that only require the access token will be endpoints that do not require any user information
 * 
 * @param req 
 * @param res 
 * @param next 
 * @returns {status} - next() if successful, otherwise 404 with error message
 */
export const verifyAccessOnly = async (req, res, next) => {
  try {
    const authorisation = req.header["authorisation"];
    const bearerToken = await parseHeaderAccess(authorisation);
    const access_token = bearerToken.access_token;
    await verifyAccessToken(access_token);
    return next();
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
};

/**
 * Middleware function for authenticating both the access token and the id token, but which does not change the request body
 * 
 * @param req 
 * @param res 
 * @param next 
 * @returns {status} - next() if successful, otherwise 404 with error message
 */
export const verifyUserIdentity = async (req, res, next) => {
  try {
    const authorisation = req.headers["authorisation"];
    const bearerTokens = await parseHeader(authorisation);
    const access_token = bearerTokens.access_token;
    const id_token = bearerTokens.id_token;
    await verifyAccessToken(access_token);
    await verifyIdToken(id_token);
    return next();
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
};