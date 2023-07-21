/* Input validation for all Endpoints */

const { check, validationResult } = require('express-validator');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// CHANGE DATE VERIFICATION WITH SPECIFIC DATE FORMAT
const numericVariables = [
	"user_id", "post_id", "recipe_id", 
	"comment_like_count", "like_count", "view_count",
	"comments_count", "follower_count", "following_count",
	"likes_count", "page", "page_size"
]
const dateVariables = ["updated_at, created_at"]

const sanitisedInput = (value) => {
	let sanitized = DOMPurify.sanitize(value);
	return sanitized.replace(/\0/g, '');
}


/* Chceks body, queries, params */
const inputValidator = [

	(req, res, next) => {
		console.log(req.params)
		next()
	},

	...numericVariables.map(id => 
		check(id)
			.optional()
			.isInt({ min: 0 })
			.withMessage(`${id} must be a positive number`)
			.notEmpty().withMessage(`${id} value must exist`)
	)
	,
	check("post_id_user_id")
		.optional()
		.isLength({ min:3, max: 50 }).withMessage("post_id_user_id must be between 3 and 50 characters long")
		.isString().withMessage(`post_id_user_id must be string`)
		.custom((value) => {
			const parts = value.split("|");

			if (parts.length !== 2) {
				  throw new Error("post_id_user_id must have two ids separated by '|'"); 
			}

			const firstPart = parseInt(parts[0]);
			const secondPart = parseInt(parts[1]);

			if (isNaN(firstPart) || isNaN(secondPart)) {
				  throw new Error("post_id_user_id must contain valid integers before and after the |");
			}

			return true;
		})
		.trim()
		.customSanitizer(value => sanitisedInput(value))
	,
	check("post_id_created_at")
		.optional()
		.isLength({ min:5, max: 50}).withMessage("post_id_created_at must be inbetween 5 and 50 characters long")
		.isString().withMessage(`post_id_created_at must be string`)
		.custom((value, { req }) => {
			const parts = value.split("|");

			if (parts.length !== 2) {
				throw new Error("post_id_created_at must have an id before the | and a valid date after"); 
			}

			const firstPart = parseInt(parts[0]);
			const secondPart = parseInt(parts[1]);

			if (isNaN(firstPart)) {
				throw new Error("post_id_created_at must contain valid integer before the |");
			}

			if (isNaN(Date.parse(secondPart))) {
				throw new Error("post_id_created_at must contain a valid date after the |");
			}

			return true;
		})
		.trim()
		.customSanitizer(value => sanitisedInput(value))
	,
	check("comment_id_user_id")
		.optional()
		.isLength({ min: 3, max: 50 }).withMessage("comment_id_user_id must be between 3 and 50 characters long")
		.custom((value, { req }) => {
			const parts = value.split("|");

			if (parts.length !== 2) {
				throw new Error("comment_id_user_id must have two ids after and before the |"); 
			}

			const secondPart = parseInt(parts[1]);

			if (isNaN(secondPart)) {
				throw new Error("comment_id_user_id must contain valid integer after the |");
			}
			
			return true;
		})
		.customSanitizer(value => sanitisedInput(value))
	,
	check("email")
		.optional()
		.isEmail().withMessage("Must be a valid email address")
		.normalizeEmail()
		.isLength({ min: 5, max: 30 }).withMessage('Email must be between 5 and 30 characters')
		.customSanitizer(value => sanitisedInput(value))
	,
	check("password")
		.optional()
		.isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
		.matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,1024}$/)
		.withMessage('Password must have at least one uppercase letter, one lowercase letter, one number, and one special character')
		.customSanitizer(value => sanitisedInput(value))
		,
	check("phonenumber")
		.optional()
		.isMobilePhone().withMessage('Must be a valid mobile phone number')
		.isLength({ min: 4, max: 15 }).withMessage('Phone number length must be between 4 and 15')
	,
	check("username")
		.optional()
		.isLength({ min: 2, max: 30 }).withMessage('Username must be between 2 and 30 characters long')
		.isAlphanumeric().withMessage('Username must only contain letters and numbers')
		.customSanitizer(value => sanitisedInput(value))
	,
	check("gender")
		.optional()
		.isIn(['male', 'female', 'non-binary']).withMessage('Gender must be either male, female, or non-binary')
	,
	check("user_bio")
		.optional()
		.isLength({ min:0, max:150 }).withMessage("user_bio needs to be between 0 and 150 characters long")
		.customSanitizer(value => sanitisedInput(value))
	,
	check("description")
		.optional()
		.isLength({ min:0, max:150 }).withMessage("description needs to be between 0 and 150 characters long")
		.customSanitizer(value => sanitisedInput(value))
	,
	...dateVariables.map(date => 
		check(date)
			.optional()
			.isDate().withMessage(`${date} must be a valid date`)
			.custom((value, { req }) => {
				const currentDate = new Date();
				const inputDate = new Date(value);
		
				if (inputDate > currentDate) {
				throw new Error(`${date} cannot be in the future`);
				}
		
				return true;
			})
	)
	,

	(req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
		  return res.status(400).json({ errors: errors.array() });
		}
		next();
	}

]




module.exports = inputValidator;