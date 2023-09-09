import { pgQuery } from "../functions/general_functions.js"

const emailOrUsername = () => {
  return async (req, res, next) => {
    if (req.body.hasOwnProperty('email')) {
      const email = req.body.email

      try {
        const result = await pgQuery('SELECT username FROM users WHERE email = $1', email)
        req.body.username = result.rows[0].username
        delete req.body.email
      } catch (error) {  
        return res.status(404).json({ 
          header: 'login failed',
          message: `user with email ${email} not found` })
      }
    }
    next()
  }
}

export default emailOrUsername