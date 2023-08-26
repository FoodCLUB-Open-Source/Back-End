/* For login system routes */
import { AuthenticationDetails, CognitoUser, CognitoUserAttribute } from "amazon-cognito-identity-js";
import { hash } from "bcrypt";
import { Router } from "express";

import rateLimiter from "../middleware/rate_limiter.js";

import cognitoUserPool from "../cognito.js";
import { pgQuery } from "../functions/general_functions.js";

const router = Router();

/* Testing Login Route */
router.get("/testing", async (req, res) => {
  try {
    res.json({ "Testing": "Working Login" });
  } catch (err) {
    console.error(err.message);
    res.json(err.message);
  }
});

/* Sign up */ 

router.post('/signup', rateLimiter(10, 1), async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!(username && email && password)) {
    return res.status(400).json({ message :"Necessary input fields not given." });
  }

  const attributeArray = [];
  const passwordHashed = await hash(password, 10)
  const dateOfBirth = "01/01/2000"

  /* aws cognito assigns a UUID value to each user's sub attribute */
  attributeArray.push(new CognitoUserAttribute({ Name: "email", Value: email }));

  cognitoUserPool.signUp(username, password, attributeArray, null, async (err, result) => {
    if (err) {
      console.error(err);
      return res.status(400).json({message: err.message});
    }
    try {
      const newUser = await pgQuery(`INSERT INTO users (username, email, password, date_of_birth) VALUES ($1, $2, $3, $4) RETURNING *`,
      username, email, passwordHashed, dateOfBirth);
    } catch (error) {
      return res.status(400).json(error.message)
    }
    return res.status(201).json({user: result.user});
  });  
})

/* Confirm verification code */
router.post('/confirmverification', rateLimiter(10, 1), (req, res) => {
  const userData = {
    Username: req.body.username,
    Pool: cognitoUserPool,
  };

  const cognitoUser = new CognitoUser(userData);

  cognitoUser.confirmRegistration(req.body.verificationCode, true, (err, result) => {
    if (err) {
      return res.status(400).json(err.message)
    }
    return res.status(201).json({message: 'user verified'})
  });
})

/* Resend Verification Code */
router.post('/resendverificationcode', rateLimiter(10, 1), (req, res) => {
  const userData = {
    Username: req.body.username,
    Pool: cognitoUserPool,
  };

  const cognitoUser = new CognitoUser(userData);

  cognitoUser.resendConfirmationCode((err, result) => {
    if (err) {
      return res.status(400).json(err.message)
    }
    res.status(200).json({ message: 'new code sent successfully' })
  });
})

 /* Sign in */

router.post('/signin', rateLimiter(10,1), (req, res) => {
  const username = req.body.username;
  
  const authenticationDetails = new AuthenticationDetails({
    Username: username,
    Password: req.body.password
  });

  const userData = {
    Username: username,
    Pool: cognitoUserPool
  };

  const cognitoUser = new CognitoUser(userData);
  
  cognitoUser.authenticateUser(authenticationDetails, {
    onSuccess: (result) =>{
      const idToken = result.getIdToken().getJwtToken();
      const accessToken = result.getAccessToken().getJwtToken();
      const refreshToken = result.getRefreshToken().getToken();
      const user = pgQuery('SELECT id, username, profile_picture FROM users WHERE username = $1', username)
      res.status(200).json(user);
    },
    onFailure: (err) => {
      res.status(400).json({
        header: 'sign in error',
        message: err.message});
    }
  });  
});


/* Sign out of application*/

router.post('/signout', rateLimiter(10,1), (req, res) => {

  const cognitoUser = cognitoUserPool.getCurrentUser()

  if (cognitoUser != null) {
    cognitoUser.signOut();
    res.status(200).json({message: 'user successfully logged out'});
  } else {
    res.status(500).json({message: 'cannot log user out'});
  };
})

/* Change password */

router.post('/changepassword', rateLimiter(10, 1), async (req, res) => {

  const cognitoUser = cognitoUserPool.getCurrentUser()  

  cognitoUser.getSession((err, session) => {
    if (err) {
      return res.status(400).json(err.message)
    }
  });
  
  cognitoUser.changePassword(req.body.oldPassword, req.body.newPassword, (err, result) => {
    if (err) {
      return res.status(400).json(err.message);
    }
    return res.status(201).json({ message: 'password changed successfully' });
  });
})

router.post('/forgotpasswordcode', async (req, res) => {
  var username = req.body.username;

  var userData = {
    Username: username,
    Pool: cognitoUserPool,
  };
  var cognitoUser = new CognitoUser(userData);
  
  cognitoUser.forgotPassword({
    onSuccess: (data) => {
      res.status(200).json({ message: 'Verification code sent' });
    },
    onFailure: (err) => {
      res.status(400).json(err.message)
    },
  });
})

router.post('/forgotpasswordcode/newpassword', (req, res) => {
  var username = req.body.username;

  var userData = {
    Username: username,
    Pool: cognitoUserPool,
  };
  var cognitoUser = new CognitoUser(userData);

  var verificationCode = req.body.verificationCode;
  var newPassword = req.body.newPassword;
  cognitoUser.confirmPassword(verificationCode, newPassword, {
    onSuccess() {
      res.status(201).json({ message: 'password reset successfully'})
    },
    onFailure(err) {
      res.status(400).json(err.message);
    },
  });
})
/* Global signout invalidates all user tokens */ 

router.post('/globalsignout', rateLimiter(10, 1), (req, res) => {
  var cognitoUser = cognitoUserPool.getCurrentUser()

  if (cognitoUser != null) {
    cognitoUser.globalSignOut();
    res.status(200).json({message: 'user successfully logged out: sign in required'});
  } else {
    res.status(500).json({message: 'cannot log user out'});
  }
})

/* Delete a user */
 
router.post('/deleteuser', rateLimiter(10, 1), (req, res) => {
  const username = req.body.username

  const userData = {
    Username: username,
    Pool: cognitoUserPool,
  };

  const cognitoUser = new CognitoUser(userData);

  cognitoUser.deleteUser((err, result) => {
    if (err) {
      return res.status(400).json(err.message);
    }
    res.status(200).json({ message: `user, ${username}, deleted` });
  });
})


router.post('/update/:attribute', (req, res) => {
  const attributeList = [];
  const newAttribute = {
	Name: req.params.attribute,
	Value: req.body.attribute,
  };
  const updatedAttribute = new AmazonCognitoIdentity.CognitoUserAttribute(newAttribute);
  attributeList.push(updatedAttribute);

  cognitoUser.updateAttributes(attributeList, function(err, result) {
    if (err) {
      res.status(401).json(err.message);
      return;
    }
    console.log('call result: ' + result);
  });
})


export default router;