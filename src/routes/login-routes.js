/* For login system routes */
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
} from "amazon-cognito-identity-js";
import { hash } from "bcrypt";
import { Router } from "express";

import rateLimiter from "../middleware/rate_limiter.js";
import inputValidator from "../middleware/input_validator.js";

import cognitoUserPool from "../config/cognito.js";
import { pgQuery } from "../functions/general_functions.js";
import emailOrUsername from "../middleware/auth_options.js";
import { getUserFromTokens } from "../functions/apply_cognito.js";

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
router.post('/signup', inputValidator, rateLimiter(), async (req, res) => {
  
  const { username, email, password, full_name } = req.body;
  
  if (!(username && email && password && full_name)) {
    return res.status(400).json({ message :"Necessary input fields not given in request" });
  }

  const attributeArray = [];
  const passwordHashed = await hash(password, 10);

  attributeArray.push(new CognitoUserAttribute({ Name: "email", Value: email }));

  cognitoUserPool.signUp(
    username,
    password,
    attributeArray,
    null,
    async (err, result) => {
      if (err) {
        console.error(err);
        return res.status(400).json({ message: err.message });
      }
      try {
        await pgQuery(
          `INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *`,
          username,
          email,
          passwordHashed
        );
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(201).json({ user: result.user });
    }
  );
});

/**
 * Verify a users verification code after sign up.
 *
 * @route POST /login/confirm_verification
 * @body {string} req.body.username - Users Username
 * @body {string} req.body.verification_code - Verification code from users email
 * @returns {status} - A successful status indicates code verfified
 * @throws {Error} - If there are errors dont verify code
 */
router.post(
  "/confirm_verification",
  inputValidator,
  rateLimiter(),
  (req, res) => {
    const { username, verification_code } = req.body;


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
      return res.status(201).json({message: 'user verified'});
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
router.post(
  "/resend_verification_code",
  inputValidator,
  rateLimiter(),
  (req, res) => {
    const { username } = req.body;

    const userData = {
      Username: username,
      Pool: cognitoUserPool,
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.resendConfirmationCode((err, result) => {
      if (err) {
        return res.status(400).json({ message: err.msg });
      }
      res.status(200).json({ message: "new code sent successfully" });
    });
  }
);

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
router.post(
  "/signin",
  inputValidator,
  rateLimiter(),
  emailOrUsername(),
  (req, res) => {
    const { username, password } = req.body; // retrieves data from request body

    const authenticationDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    });

    const userData = {
      Username: username,
      Pool: cognitoUserPool,
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: async (result) => {
        const user = await pgQuery(
          // make a query to database
          "SELECT id, username, profile_picture FROM users WHERE username = $1",
          username
        );
        res.setHeader(
          "Id-Token",
          cognitoUser.getSignInUserSession().getIdToken()
        );
        res.setHeader(
          "Access-Token",
          cognitoUser.getSignInUserSession().getAccessToken()
        );
        res.setHeader(
          "Refresh-Token",
          cognitoUser.getSignInUserSession().getRefreshToken()
        );
        res.status(200).json({ user: user.rows[0] }); // return user data
      },
      onFailure: (err) => {
        if (err.message === "User is not confirmed.") {
          res.redirect(
            307,
            `${process.env.BASE_PATH}/login/resend_verification_code` // redirect to resend verification code page
          );
        } else if (err.code === "UserNotFoundException") {
          res.status(400).json({
            header: "user not found",
            message: "User does not exist",
          });
        } else {
          res.status(400).json({
            header: "sign in error",
            message: `Error occurred when signing in: ${[err.message].join(
              "\n"
            )}`,
          });
        }
      },
    });
  }
);

/**
 * Sign a user out
 *
 * @route POST /login/signout
 * @body
 * @returns {status} - A successful status means sign out successful
 * @throws {Error} - If there are errors dont sign a user out
 */
router.post("/signout", rateLimiter(), (req, res) => {
  // const { username } = req.body

  const cognitoUser = cognitoUserPool.getCurrentUser();

  try {
    cognitoUser.getSession((err, session) => {
      if (err) {
        return res.status(400).json(err.message);
      }
    });
  } catch (err) {
    return res.status(400).json({
      header: "session not found",
      message: "no user tokens in local storage: cannot log user out",
    });
  }

  if (cognitoUser != null) {
    cognitoUser.signOut((err) => {
      if (err) {
        return res.status(400).json(err.message);
      }
    });
    return res.status(200).json({ message: "user successfully logged out" });
  } else {
    return res.status(500).json({
      message: "no user tokens in local storage: cannot log user out",
    });
  }
});

/**
 * Changes a users password from old to new
 *
 * @route POST /login/change_password
 * @body {string} req.body.old_password - Users old password
 * @body {string} req.body.new_password - Users new password
 * @returns {status} - A successful status indicates password successfully changed
 * @throws {Error} - If there are errors dont change the users passwords
 */
router.post("/change_password", inputValidator, rateLimiter(), (req, res) => {
  const { old_password, new_password } = req.body;
  console.log("HIT");

  getUserFromTokens((err, result) => {
    if (err) {
      return res.status(400).json(err);
    } else if (result) {
      const cognitoUser = result;
      console.log(cognitoUser);

      cognitoUser.changePassword(old_password, new_password, (err, result) => {
        if (err) {
          return res.status(400).json({ message: err.msg });
        }
        return res
          .status(201)
          .json({ message: "password changed successfully" });
      });
    }
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
router.post(
  "/forgot_password/verification_code",
  inputValidator,
  rateLimiter(),
  emailOrUsername(),
  async (req, res) => {
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
        res.status(400).json({ message: err.msg });
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
router.post(
  "/forgot_password_code/new_password",
  inputValidator,
  rateLimiter(),
  (req, res) => {
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
 * Send another verification code to user
 *
 * @route POST /login/global_signout
 * @body req.body.username - the user's username
 * @returns {status} - A successful status indicates user is signed out on all devices he is logged in on
 * @throws {Error} - If there are errors dont sign user out on any device
 */
router.post("/global_signout", rateLimiter(), (req, res) => {
  getUserFromTokens((err, result) => {
    if (err) {
      return res.status(400).json(err);
    } else if (result) {
      const cognitoUser = result;
      console.log(cognitoUser);

      cognitoUser.deleteUser(async (err, result) => {
        if (err) {
          return res.status(400).json({ message: err.msg });
        }
        try {
          await pgQuery("DELETE FROM users WHERE username = $1", username);
        } catch (error) {
          return res
            .status(400)
            .json({ message: "user not deleted from database" });
        }
        res.status(200).json({ message: `user, ${username}, deleted` });
      });
    }
  });
});

router.delete("/delete_user", rateLimiter(), (req, res) => {
  const username = req.body.username;

  getUserFromTokens((err, result) => {
    if (err) {
      return res.status(400).json(err);
    } else if (result) {
      const cognitoUser = result;

      cognitoUser.deleteUser(async (err, result) => {
        if (err) {
          return res.status(400).json({ message: err.msg });
        }
        try {
          await pgQuery("DELETE FROM users WHERE username = $1", username);
        } catch (error) {
          return res
            .status(400)
            .json({ message: "user not deleted from database" });
        }
        res.status(200).json({ message: `user, ${username}, deleted` });
      });
    }
  });
});

export default router;
