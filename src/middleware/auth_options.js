/* This file contains authentication-related middleware */
import { pgQuery } from "../functions/general_functions.js"

const emailOrUsername = () => {
  return async (req, res, next) => {

    // checking if the request has email or username in the body
    if (req.body.hasOwnProperty('email')) {
      const email = req.body.email
      // look up the user's email address in psql: get their username
      try {
        const result = await pgQuery('SELECT username FROM users WHERE email = $1', email)
        req.body.username = result.rows[0].username
        delete req.body.email
        // remove the email from the request body
      } catch (error) {  
        // error handling: user cannot sign in as their user does not exist in the database
        return res.status(404).json({ 
          header: 'login failed',
          message: `user with email ${email} not found` })
      }
    }
    next()
  }
}

export default emailOrUsername