/* Input validation for all Endpoints */
import createDOMPurify from "dompurify";

import { check, validationResult } from "express-validator";
import { JSDOM } from "jsdom";

//for input sanitisation
const window = new JSDOM().window;
const DOMPurify = createDOMPurify(window);

// CHANGE DATE VERIFICATION WITH SPECIFIC DATE FORMAT
const numericVariables = [
	"user_id", "post_id", "recipe_id", 
	"comment_like_count", "like_count", "view_count",
	"comments_count", "follower_count", "following_count",
	"likes_count", "page_number", "page_size", "category_id", "user_following_id",
	"serving_size","preparation_time",

];
const nanoIdVariables = ["story_id"];
const dateVariables = ["updated_at", "created_at"];

const sanitisedInput = (value) => {
	let sanitized = DOMPurify.sanitize(value);
	return sanitized.replace(/\0/g, '');
};

/* Checks body, queries, params */
const inputValidator = [
	...numericVariables.map(id => 
		check(id)
			.optional()
			.isInt({ min: 0 })
			.withMessage(`${id} must be a positive number`)
			.notEmpty().withMessage(`${id} value must exist`)
	),
	...nanoIdVariables.map(id => 
		check(id)
		.optional()
		.isLength({ min: 20, max: 22 }).withMessage((value) => `${value} must be 21 letters long`)
    	.matches(/^[0-9A-Za-z_-]*$/).withMessage((value) => `nano id ${value} must only contain a-z, A-z,0-9,_,-`)
		.trim() 
	),
	check("email")
		.optional()
		.isEmail().withMessage("Must be a valid email address")
		.normalizeEmail()
		.isLength({ min: 5, max: 30 }).withMessage('Email must be between 5 and 30 characters')
		.customSanitizer(value => sanitisedInput(value))
		.trim(),
	check(["password", "old_password", "new_password"])
		.optional()
		.isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
		.matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,1024}$/)
		.withMessage('Password must have at least one uppercase letter, one lowercase letter, one number, and one special character')
		.customSanitizer(value => sanitisedInput(value))
		.trim(),
	check("phonenumber")
		.optional()
		.isMobilePhone().withMessage('Must be a valid mobile phone number')
		.isLength({ min: 4, max: 15 }).withMessage('Phone number length must be between 4 and 15'),
	check("username")
		.optional()
		.isLength({ min: 2, max: 30 }).withMessage('Username must be between 2 and 30 characters long')
		.isAlphanumeric().withMessage('Username must only contain letters and numbers')
		.customSanitizer(value => sanitisedInput(value))
		.trim(),
	check("full_name")
		.optional()
		.isLength({min: 1, max: 255}).withMessage('Full name is too short/long')
		.isAlpha().withMessage('Full name must only contain letters')
		.customSanitizer(value => sanitisedInput(value))
		.trim(),
	check('verified')
		.optional(),
	check("gender")
		.optional()
		.isIn(['male', 'female']).withMessage('Gender must be either male, female, or non-binary'),
	check("user_bio")
		.optional()
		.isLength({ min:0, max:150 }).withMessage("user_bio needs to be between 0 and 150 characters long")
		.customSanitizer(value => sanitisedInput(value))
		.trim(),
	check("description")
		.optional()
		.isLength({ min:0, max:150 }).withMessage("description needs to be between 0 and 150 characters long")
		.customSanitizer(value => sanitisedInput(value))
		.trim(),
	...dateVariables.map(date => 
		check(date)
			.optional()
			.custom((value) => {
				const currentDate = new Date();
				const inputDate = new Date(value);
				
				if (inputDate > currentDate) {
					throw new Error(`${value} cannot be in the future`);
				}

				const isoDateFormatRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  				
				if (!isoDateFormatRegex.test(value)){
					throw new Error(`${value} must be in the correct format of : 2023-07-31T15:30:00.000Z`);
				}
				
				return true;
			})
	),
	check("verification_code")
		.optional()
		.isInt()
		.isLength({ min: 6, max: 6 })
	,
	check(["video_url", "thumbnail_url"])// NEEDS TESTING AFTER WE CAN UPLOAD FILES AGAIN
		.optional()
		.custom((value) => {
			if (value.slice(0,37) !== process.env.CLOUDFRONT_URL){
				throw new Error(`${value} is not calling the appropriate cloudfront url`);
			}
			if (value.length < 37){
				throw new Error(`${value} must be at the very least 37 letters long`);
			}
		})
		.isURL().withMessage((value) => `Invalid URL format for ${value}`)
		.trim(),
	check("video_name", "thumbnail_name")
		.optional()
		.isLength({ min: 5 }).withMessage((value) => `${value} must be atleast 5 characters long`)
		.customSanitizer(value => sanitisedInput(value))
		.trim(),
	
	check("recipe_description")
		.optional()
		.isString()
		.withMessage("recipe_description must be a string")
		.customSanitizer((value) => sanitisedInput(value))
		.trim(),
	
	check("recipe_ingredients")
		.optional()
		.isArray()
		.withMessage("recipe_ingredients must be an array")
		.custom((value) => {
		  if (!Array.isArray(value)) {
			throw new Error("recipe_ingredients should be an array");
		  }
	  
			// Check each element in the array for the specified format
			/* correct format = [
				"(ingredient 1, Amount g)",
				 more ....
 			 ],
			*/
		  for (const ingredient of value) {
			if (!/^\(.*,\s*\d+\s*g\)$/.test(ingredient)) {
			  throw new Error(
				"recipe_ingredients should be in the format '(ingredient, amount g)'"
			  );
			}
		  }
	  
		  return true;
		}),
	
	  check("recipe_equipment")
		.optional()
		.isArray()
		.withMessage("recipe_equipment must be an array"),
	
	  check("recipe_steps")
		.optional()
		.isArray()
		.withMessage("recipe_steps must be an array"),
	
	(req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
		  return res.status(400).json({ errors: errors.array() });
		}
		next();
	}
];

export default inputValidator;