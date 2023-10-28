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

export const verifyAccessToken = async (req, res, next) => {

  const userAccessToken = req.header['Access-Token'] 

  try {
    const payload = await accessVerifier.verify(
      userAccessToken.getJwtToken()
    );
    res.status(200).json({
      message: 'Access token is valid',
      payload: payload
    });
  } catch {
    // If the access token is not valid, the refresh token will be validated. 
    res.status(400).json({message: 'Request new access token'})
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