import { CognitoAccessToken, CognitoIdToken } from "amazon-cognito-identity-js"
import { cognitoUserPool, accessVerifier, refreshVerifier, idVerifier }from "../cognito.js";
import { pgQuery } from "../functions/general_functions.js";

// All tokens should be passed from frontend and stored as strings, not as objects.
// Verifier that expects valid access tokens:

export const verifyAccessToken = async (req, res, next) => {

  const access_token = req.header['Access-Token'];

  if (!!access_token) {
    try {
      const accessTokenObject = new CognitoAccessToken(access_token);
      await accessVerifier.verify(
        accessTokenObject.getJwtToken()
      );
      return 'Access Token Valid';
    } catch {
      // If the access token is not valid, the refresh token will be validated. 
      return res.status(400).json({message: 'Request new access token'});
    };
  } else {
    return res.status(404).json({message: 'Access token is null'});
  };
  next();
};

// The function below is only necessary for an extra layer of security with id tokens. It is not yet needed for implementation.

export const verifyIdToken = async (req, res, next) => {
  
  const id_token = req.header['Id-Token'];

  if (!!id_token) {
    const idTokenObject = new CognitoIdToken(id_token)
    try {
      const payload = await idVerifier.verify(
        idTokenObject.getJwtToken()
      );
      req.body.payload = {
        user_id: payload['custom:id'],
        username: payload['cognito:username']
      };
    } catch {
      return res.status(400).json({ 
        header: "ID Token not valid",
        message: "Session refresh required"
      });
    }
  } else {
    return res.status(400).json({
      message: "ID token is null"
    })
  }
  next()
}

export const verifySession = async (req, res, next) => {
  const cognitoUser = cognitoUserPool.getCurrentUser() 

  cognitoUser.getSession((err, session) => {
    if (err) {
      return res.redirect(307, `${process.env.BASE_PATH}/login/signin`)
    }
  });
} 