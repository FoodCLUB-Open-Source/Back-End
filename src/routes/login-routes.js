/* For login system routes */
import {
  AuthenticationDetails,
  CognitoRefreshToken,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserSession
} from "amazon-cognito-identity-js";
import { hash } from "bcrypt";
import { Router } from "express";

import rateLimiter from "../middleware/rate_limiter.js";
import inputValidator from "../middleware/input_validator.js";

import { cognitoUserPool, refreshVerifier } from "../config/cognito.js";
import { pgQuery } from "../functions/general_functions.js";
import emailOrUsername from "../middleware/auth_options.js";

const router = Router();

/* Testing Login Route */
router.get("/testing", async (req, res) => {
  try {
    res.json({ Testing: "Working Login" });
  } catch (err) {
    console.error(err.message);
    res.json(err.message);
  }
});

/**
 * Sign up a user
 *
 * @route POST /login/signup
 * @body {string} req.body.username - Users Username
 * @body {string} req.body.email - Users email
 * @body {string} req.body.password - Users password
 * @returns {status} - A status indicating successful sign up
 * @throws {Error} - If there are errors Dont create user.
 */

router.post("/signup", inputValidator, rateLimiter(), async (req, res) => {
  //retrieves data in object format from front end and stores correspoding values in the variables
  const { username, email, password, full_name } = req.body;

  //if the following varaible are not valid, it will execute this error condition
  if (!(username && email && password && full_name)) {
    return res.status(400).json({ message: "Necessary input fields not given." });
  }

  const attributeArray = [];
  const passwordHashed = await hash(password, 10);


  attributeArray.push(new CognitoUserAttribute({ Name: "email", Value: email }));

  cognitoUserPool.signUp(username, password, attributeArray, null, async (err, result) => {
    if (err) {
      console.error(err);
      return res.status(400).json({message: err.message});
    }
    
    const userData = {
      Username: username,
      Pool: cognitoUserPool,
    };
  
    const cognitoUser = new CognitoUser(userData);

    try {
      const verified = false;
      await pgQuery(`INSERT INTO users (username, email, password, full_name, verified) VALUES ($1, $2, $3, $4, $5)`,
      username, email, passwordHashed, full_name, verified);
    } catch (error) {
      cognitoUser.deleteUser((err, result) => {
        if (err) {
          return res.status(400).json({ message: err.message });
        }
      });
      return res.status(400).json({ message: error.message });
    }

    return res.status(201).json({
      username: username,
      verification_status: 'not verified',
      email: email,
      full_name: full_name,
      session: null
    });
  });  
});

/**
 * Verify a users email using verification code after sign up.
 * 
 * @route POST /login/confirm_verification
 * @body {string} req.body.username - Users Username
 * @body {string} req.body.verification_code - Verification code from users email
 * @body {string} req.body.password - password, for logging in user after confirmation
 * @returns {status} - A successful status indicates code verfified
 * @throws {Error} - If there are errors dont verify code
 */
router.post('/confirm_verification', inputValidator, rateLimiter(), (req, res) => {

  const { username, password, verification_code } = req.body;

  const userData = {
    Username: username,
    Pool: cognitoUserPool,
  };

  const cognitoUser = new CognitoUser(userData);
  cognitoUser.confirmRegistration(verification_code, true, async (err, result) => {
    if (err) {
      return res.status(400).json({ message: err.message })
    }
    try {
      const verified = true
      await pgQuery(`UPDATE users SET verified = $1 WHERE username = $2`, verified, username)
    } catch (error) {
      res.status(400).json({ message: error.message })
    }

    const authenticationDetails = new AuthenticationDetails({
      Username: username,
      Password: password
    });
    
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: async (result) => {
        const user = await pgQuery('SELECT id, username, profile_picture FROM users WHERE username = $1', username);
        const user_id = user.rows[0].id.toString()
        cognitoUser.updateAttributes(
          [new CognitoUserAttribute({ Name: "custom:id", Value: user_id})],
          (err, result) => {
            if (err) {
              //return res.status(400).json(err.message)
              console.log(err.message)
            }
          })

        const signInUserSession = cognitoUser.getSignInUserSession()
        const idToken =  signInUserSession.getIdToken()
        const accessToken = signInUserSession.getAccessToken()
        const refreshToken = signInUserSession.getRefreshToken()

        res.setHeader('Id-Token', idToken);
        res.setHeader('Access-Token', accessToken);
        res.setHeader('Refresh-Token', refreshToken);

        res.status(200).json({ 
          header: 'user logged in',
          message: 'user email verified successfully',
          user: user.rows[0],
        });
      },
      onFailure: (err) => {
        return res.status(400).json({message: err.message})      
      }
    }); 
  });
});


/**
 * Send another verification code to user
 *
 * @route POST /login/resend_verification_code
 * @body {string} req.body.username - Users Username
 * @returns {status} - A successful status indicates code resent
 * @throws {Error} - If there are errors dont send another verififcation code
 */
router.post("/resend_verification_code",inputValidator,rateLimiter(),(req, res) => {
  const { username } = req.body;

  const userData = {
    Username: username,
    Pool: cognitoUserPool,
  };

  const cognitoUser = new CognitoUser(userData);
  
  cognitoUser.resendConfirmationCode((err, result) => {
    if (err) {
      return res.status(400).json({ message: err.message })
    }
    res.status(200).json({ 
      header: 'User email is not confirmed',
      message: 'new code sent successfully' })
  });
});
/**
 * Allows a user to sign in to their account
 *
 * @route POST /login/signin
 * @body {string} req.body.username - Users Username
 * @body {string} req.body.email - the user's email address. Either usename or email can be used.
 * @body {string} req.body.password - Users password
 * @returns {status} - A successful status indicates successful sign in
 * @throws {Error} - If there are errors dont sign user in
 */
router.post("/signin",inputValidator,rateLimiter(),emailOrUsername(),(req, res) => {
  const { username, password } = req.body;

  const userData = {
    Username: username,
    Pool: cognitoUserPool
  };

  const cognitoUser = new CognitoUser(userData);

  const authenticationDetails = new AuthenticationDetails({
    Username: username,
    Password: password
  });
  
  cognitoUser.authenticateUser(authenticationDetails, {
    onSuccess: async (result) =>{
      const user = await pgQuery('SELECT id, username, profile_picture FROM users WHERE username = $1', username);
      // signInUserSession is an instance of CognitoUserSession
      // these return object instances, not just strings of the tokens.
      // we need the special key to use jwt.sign to add to the payload.
      const signInUserSession = cognitoUser.getSignInUserSession()

      const idToken =  signInUserSession.getIdToken()
      const accessToken = signInUserSession.getAccessToken()
      const refreshToken = signInUserSession.getRefreshToken()

      // user id is in idToken.payload['custom:id']       
      res.setHeader('Id-Token', idToken);
      res.setHeader('Access-Token', accessToken);
      res.setHeader('Refresh-Token', refreshToken);
      res.status(200).json({ user: user.rows[0] });
    },
    onFailure: (err) => {
      if (err.message == "User is not confirmed.") {
        cognitoUser.resendConfirmationCode((err, result) => {
          if (err) {
            return res.status(400).json({ message: err.message })
          }
          res.status(400).json({ 
            message: 'User is not verified',
            description: 'new verification code email sent'
          })
        });
      } else if (err.code == "UserNotFoundException") {
        res.status(400).json({
          header: 'user not found',
          message: 'User does not exist'
        });
      } else {
        res.status(400).json({
          header: 'sign in error',
          message: err.message
        });
      };
    }
  });  
});

/**
 * Sign a user out
 *
 * @route POST /login/signout
 * @body {string} req.body.username - the username of the user.
 * @returns {status} - A successful status means sign out successful
 * @throws {Error} - If there are errors dont sign a user out
 */

///@dev this endpoint will need the verify endpoint, to only allow a signed in user to make a sign out request.
router.post("/signout", rateLimiter(), (req, res) => {
  const { username } = req.body

  const userData = {
    Username: username,
    Pool: cognitoUserPool
  };

  const cognitoUser = new CognitoUser(userData);

  if (cognitoUser != null) {
    cognitoUser.signOut((err, result) => {
      if (err) {
        return res.status(400).json(err.message);
      }
    });
    return res.status(200).json({ 
      message: "user successfully logged out" 
      
    });
  } else {
    return res.status(404).json({
      message: "Username is not found: user could not be signed out.",
    });
  }
});

/**
 * Changes a users password from old to new
 *
 * @route POST /login/change_password
 * @header {CognitoAccessToken} - the user's access token
 * @header {CognitoIdToken} - the user's id token
 * @body {string} req.body.old_password - Users old password
 * @body {string} req.body.new_password - Users new password
 * @returns {status} - A successful status indicates password successfully changed
 * @throws {Error} - If there are errors dont change the users passwords
 */
router.post("/change_password", inputValidator, rateLimiter(), (req, res) => {
  const { username, old_password, new_password } = req.body;

  const userData = {
    Username: username,
    Pool: cognitoUserPool
  };
  
  const userAccessToken = req.header['Access-Token']
  const userIdToken = req.header['Id-Token']
  /* Below sets the session for the user using tokens: effectively 'signing the user in' for this action which requires the user to be 
  authenticated. For this, the id token and the access token are required in the request header.
  */

  const sessionData = {
    IdToken: userIdToken,
    AccessToken: userAccessToken,
    RefreshToken: null,
    ClockDrift: null,
  };

  const cognitoUserSession = new CognitoUserSession(sessionData)

  const cognitoUser = new CognitoUser(userData);

  cognitoUser.setSignInUserSession(cognitoUserSession) 

  cognitoUser.changePassword(old_password, new_password, (err, result) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    return res
      .status(201)
      .json({ message: "password changed successfully" });
  });
});

/**
 * Sends a user a forgot password verification code
 *
 * @route POST /login/forgot_password/verification_code
 * @body {string} req.body.username - Users Username
 * @returns {status} - A successful status indicates code is sent
 * @throws {Error} - If there are errors dont send a code
 */
router.post("/forgot_password/verification_code",inputValidator,rateLimiter(),emailOrUsername(),async (req, res) => {
    const { username } = req.body;

    const userData = {
      Username: username,
      Pool: cognitoUserPool,
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.forgotPassword({
      onSuccess: (data) => {
        res.status(200).json({ message: "Verification code sent" });
      },
      onFailure: (err) => {
        res.status(400).json({ message: err.message });
      },
    });
  }
);

/**
 * Uses verification code to  change the password
 *
 * @route POST /login/forgot_password_code/new_password
 * @body {string} req.body.username - Users Username
 * @body {string} req.body.verification_code - Verification code that was sent
 * @body {string} req.body.newPassword - Users new password
 * @returns {status} - A successful status indicates new password has been set
 * @throws {Error} - If there are errors dont chagne the password
 */
router.post("/forgot_password_code/new_password",inputValidator,rateLimiter(),(req, res) => {
    const { username, verification_code, new_password } = req.body;

    const userData = {
      Username: username,
      Pool: cognitoUserPool,
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.confirmPassword(verification_code, new_password, {
      onSuccess() {
        res.status(201).json({ message: "password reset successfully" });
      },
      onFailure(err) {
        res.status(400).json({ message: err });
      },
    });
  }
);

/**
 * Global sign out: invalidates all user tokens on all devices.
 *
 * @route POST /login/global_signout
 * @body req.body.username - the user's username
 * @returns {status} - A successful status indicates user is signed out on all devices he is logged in on
 * @throws {Error} - If there are errors dont sign user out on any device
 */
router.post("/global_signout", rateLimiter(), (req, res) => {
  const { username } = req.body;
  
  const userData = {
    Username: username,
    Pool: cognitoUserPool,
  };
  
  const userAccessToken = req.header['Access-Token']
  const userIdToken = req.header['Id-Token']

  const sessionData = {
    IdToken: userIdToken,
    AccessToken: userAccessToken,
    RefreshToken: null,
    ClockDrift: null,
  };

  const cognitoUserSession = new CognitoUserSession(sessionData)

  const cognitoUser = new CognitoUser(userData);

  cognitoUser.setSignInUserSession(cognitoUserSession) 

  cognitoUser.globalSignOut({
    onSuccess: (result) => { 
      res.status(200).json('User signed out globally')
    },
    onFailure: (err) => {
      res.status(400).json(err.message)
    }
  });
});

/**
 * Use the refresh token to get a new access token, if possible.
 * 
 * @route POST /login/refresh_token
 * @header req.header['Refresh-Token'] - the refresh token as a string
 * @body req.body.username - the username of the user making the request
 * @returns {status} -  a successful status indicates that the refresh token has been successfully
 * used to refresh the user's session and generate new tokens.
 * The tokens (access, refresh and id) are returned as CognitoUserSession() object.
 * @throws {Error} - If the refresh token is not valid, or there is another internal error.
 */

router.post('/refresh_token', rateLimiter(10, 1), async (req, res) => {

  const refresh_token = req.header['Refresh-Token'];
  const { username } = req.body
  // First check whether the refresh token is valid

  if (!!refresh_token) {
    // first check if valid: verify the token
    const refreshTokenObject  = new CognitoRefreshToken(refresh_token)
    try {
      await refreshVerifier.verify(
        refreshTokenObject.getJwtToken()
      );

      const userData = {
        Username: username,
        Pool: cognitoUserPool,
      };
    
      const cognitoUser = new CognitoUser(userData);

      cognitoUser.refreshSession(refreshTokenObject, (err, result) => {
        if (err) {
          return res.status(400).json(err.message);
        };
        // if user_id not in payload, we can just use a lookup in psql with username.

        // if successful, the user's new tokens are returned as a CognitoUserSession object instance.
        res.setHeader('Id-Token', result.getIdToken());
        res.setHeader('Access-Token', result.getAccessToken());
        res.setHeader('Refresh-Token', result.getRefreshToken());

        return res.status(200).json({
          message: 'Session refresh successful',
        });
      })
    } catch {
      res.status(400).json({
        message: 'Refresh token invalid. Please re-authenticate.'
      });
    };
  } else {
    res.status(400).json({message: 'Refresh token not provided'});
  };
});

export default router;
