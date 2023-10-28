import { cognitoUserPool, accessVerifier, refreshVerifier, idVerifier }from "../cognito.js";
// Verifier that expects valid access tokens:

export const verifySession = async (req, res, next) => {
  const cognitoUser = cognitoUserPool.getCurrentUser() 

  cognitoUser.getSession((err, session) => {
    if (err) {
      return res.redirect(307, `${process.env.BASE_PATH}/login/signin`)
    }
  });
} 

export const verifyTokens = async (req, res, next) => {
  
  const cognitoUser = cognitoUserPool.getCurrentUser() 

  cognitoUser.getSession((err, session) => {
    if (err) {
      return res.status(400).json(err.message)
    }
  });

  try {
    const payload = await accessVerifier.verify(
      cognitoUser.getSignInUserSession().getAccessToken().getJwtToken()
    );
    res.status(200).json({
      message: 'Access token is valid',
      payload: payload
    });
  } catch {
    // If the access token is not valid, the refresh token will be validated. 
    try {
      await cognitoUser.refreshSession(cognitoUser.getSignInUserSession().getRefreshToken().getJwtToken())
    } catch (error) {
      return res.redirect(307, `${process.env.BASE_PATH}/login/signin`)
    };
  }
  next()
}

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