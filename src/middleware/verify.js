import { CognitoJwtVerifier } from "aws-jwt-verify";
import cognitoUserPool from "../cognito.js";
// Verifier that expects valid access tokens:

const verifyAccess = async (req, res, next) => {
  const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.USER_POOL_ID,
    tokenUse: "access",
    clientId: process.env.CLIENT_ID,
  });
  
  const cognitoUser = cognitoUserPool.getCurrentUser()  

  cognitoUser.getSession((err, session) => {
    if (err) {
      return res.status(400).json(err.message)
    }
  });

  try {
    const payload = await verifier.verify(
      cognitoUser.getCurrentUser().get
    );
    res.status(200).json({message: `Token is valid. Payload: ${payload}`});
  } catch {
    res.status(400).json({ message: "Token not valid" });
  }
  next()
}

const verifyId= async (req, res, next) => {
  const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.USER_POOL_ID,
    tokenUse: "id",
    clientId: process.env.CLIENT_ID,
  });
  
  const cognitoUser = cognitoUserPool.getCurrentUser()  

  cognitoUser.getSession((err, session) => {
    if (err) {
      return res.status(400).json(err.message)
    }
  });

  try {
    const payload = await verifier.verify(
      cognitoUser.getCurrentUser().get
    );
    res.status(200).json({message: `Token is valid. Payload: ${payload}`});
  } catch {
    res.status(400).json({ message: "Token not valid" });
  }
  next()
}