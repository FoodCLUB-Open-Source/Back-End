import { cognitoUserPool, accessVerifier, refreshVerifier, idVerifier }from "../cognito.js";
import { pgQuery } from "../functions/general_functions.js";

// Verifier that expects valid access tokens:

export const verifyAccessToken = async (req, res, next) => {

  const userAccessToken = req.header['Access-Token'];
  
  if (!!userAccessToken) {
    try {
      const payload = await accessVerifier.verify(
        userAccessToken.getJwtToken()
      );
      const username = payload.username
      const user_id = await pgQuery('SELECT user_id FROM users WHERE username = $1', username);
      return {
        username: username,
        user_id: user_id,
        userSignedIn: true
      };
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
  
  const cognitoUser = cognitoUserPool.getCurrentUser()  

  cognitoUser.getSession((err, session) => {
    if (err) {
      return res.status(400).json(err.message)
    }
  });

  try {
    const payload = await idVerifier.verify(
      cognitoUser.getCurrentUser().get
    );
    res.status(200).json({message: `Token is valid. Payload: ${payload}`});
  } catch {
    res.status(400).json({ message: "Token not valid" });
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