/* Input validation for all Endpoints */

const { body, param, query, header, validationResult } = require('express-validator');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/* The headers we are using will need to be validated. I only added the basic ones */

/* Chceks body, queries, params */
const inputValidator = () => {    
    return async (req, res, next) => {

        if (Object.keys(req.body).length !== 0) {
            for (const [key, value] of Object.entries(req.body)){
                validateAndSanitize(key, value, req, "body");
            };
        };

		if (Object.keys(req.query).length !== 0) {
            for (const [key, value] of Object.entries(req.query)){
                validateAndSanitize(key, value, req, "query");
            };
        };

		if (Object.keys(req.params).length !== 0) {
            for (const [key, value] of Object.entries(req.params)){
                validateAndSanitize(key, value, req, "params");
            };
        };

		if (Object.keys(req.headers).length !== 0) {
            for (const [key] of Object.entries(req.headers)){
                headerValidation(key, req)
            };
        };
		
		const errors = validationResult(req);
		console.log(errors.array())
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		};

        next();
    }
}

/*This will do the validation and recurse if an array or object */
const validateAndSanitize = (key, value, req, source) => {

	let validator;

	if (source === "body") { validator = body }
	else if (source === "query") { validator = query }
	else if (source === "params") { validator = param };

    if (typeof(value) === "string"){
        let sanitized = DOMPurify.sanitize(value);
        sanitized = sanitized.replace(/\0/g, '');
		
        validator(key)
			.exists().withMessage(`${key} value must exist`)
            .isLength({min: 1, max: 500}).withMessage(`${key} value must be between 2 and 500 characters long`)
            .trim()
            .customSanitizer(() => sanitized)
    
    }

    else if (typeof(value) === "number" || typeof(value) === "boolean"){
        
		validator(key)
            .exists().withMessage(`${key} value must exist`)

    }

    if (Array.isArray(value)) {
        for(let i = 0; i < value.length; i++) {
            validateAndSanitize(`${key}[${i}]`, value[i], req, source);
        }
    }

    else if (typeof(value) === 'object' && value !== null && !(value instanceof Array)) {
        for(const property in value) {
            if (value.hasOwnProperty(property)) {
                validateAndSanitize(`${key}.${property}`, value[property], req, source);
            }
        }
    } else {
		validateFrequent(key, req, source);
	}

}

/* Used to validate the headers */
const headerValidation = (key, req) => {

	if (key === "content-type"){

		header(key)
			.isIn(['application/json', 'multipart/form-data'])
			.withMessage('Content-Type must be application/json or multipart/form-data')
	
	} else if (key === "accept"){

		header(key)
			.custom(value => ['application/json', 'multipart/form-data'].includes(value))
			.withMessage("Accept must be application/json or multipart/form-data")

		}
}

/* Used to vlidate frequently used variables */
const validateFrequent = (key, req, source) => {
	let validator;

	if (source === "body") {validator = body}
	else if (source === "query") {validator = query}
	else if (source === "params") {validator = param};

	//numeric IDs and number counts
	const numeric = [
		"user_id", "post_id", "recipe_id", 
		"comment_like_count", "like_count", "view_count",
		"comments_count", "follower_count", "following_count",
		"likes_count", "page", "page_size"
	];

	if (numeric.includes(key)) {

		validator(key)
			.toInt()
			.isInt({ min:0 }).withMessage(`${key} is not a number or not larger than 0`)

	//Dynamo DB where id is number # number.
	} else if (key === "post_id_user_id"){

		validator(key)
			.isLength({ min: 3, max: 50 }).withMessage("post_id_user_id must be between 3 and 50 characters long")
			.custom((value, { req }) => {
				const parts = value.split("#");

				if (parts.length !== 2) {
				  	throw new Error("post_id_user_id must have two ids separated by '#'"); 
				}

				const firstPart = parseInt(parts[0]);
				const secondPart = parseInt(parts[1]);

				if (isNaN(firstPart) || isNaN(secondPart)) {
				  	throw new Error("post_id_user_id must contain valid integers before and after the #");
				}

				return true;
			})

	//DynamoDB where ids is number # date
	} else if (key === "post_id_created_at"){

		validator(key)
			.isLength({ min: 5, max: 50 }).withMessage("post_id_created_at must be between 5 and 50 characters long")
			.custom((value, { req }) => {
				const parts = value.split("#");

				if (parts.length !== 2) {
				  	throw new Error("post_id_created_at must have an id before the # and a valid date after"); 
				}

				const firstPart = parseInt(parts[0]);
				const secondPart = parseInt(parts[1]);

				if (isNaN(firstPart)) {
				  	throw new Error("post_id_created_at must contain valid integer before the #");
				}

				if (isNaN(Date.parse(secondPart))) {
					throw new Error("post_id_created_at must contain a valid date after the #");
				}

				return true;
			})

	//DynamoDB where id is string # number
	} else if (key === "comment_id_user_id"){

		validator(key)
			.isLength({ min: 3, max: 50 }).withMessage("comment_id_user_id must be between 3 and 50 characters long")
			.custom((value, { req }) => {
				const parts = value.split("#");

				if (parts.length !== 2) {
				  	throw new Error("comment_id_user_id must have two ids after and before the #"); 
				}

				const secondPart = parseInt(parts[1]);

				if (isNaN(secondPart)) {
				  	throw new Error("comment_id_user_id must contain valid integer after the #");
				}
				
				return true;
			})

	} else if (key === "email"){

		validator(key)
			.isEmail().withMessage("Must be a valid email address")
			.normalizeEmail()
			.isLength({ min: 5, max: 30 }).withMessage('Email must be between 5 and 30 characters')

	} else if (key === "password"){

		validator(key)
			.isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
			.matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,1024}$/)
			.withMessage('Password must have at least one uppercase letter, one lowercase letter, one number, and one special character')

	} else if (key === "phonenumber"){

		validator(key)
			.isMobilePhone().withMessage('Must be a valid mobile phone number')
			.isLength({ min: 4, max: 15 }).withMessage('Phone number length must be between 4 and 15')
			.matches(/^\+?[1-9]\d{1,14}$/).withMessage('Must be a valid international phone number')

	} else if (key === "username") {

		validator(key)
			.isLength({ min: 2, max: 30 }).withMessage('Username must be between 2 and 30 characters long')
			.isAlphanumeric().withMessage('Username must only contain letters and numbers')

	} else if (key === "gender") {

		validator(key)
  			.isIn(['male', 'female', 'non-binary']).withMessage('Gender must be either male, female, or non-binary')

	} else if (key === "user_bio" || key === "description") {

		validator(key)
			.isLength({ min: 0, max: 150 }).withMessage('Username must be between 0 and 150 characters long')

	}
	else if ((key === "created_at") || (key === "updated_at")) {

		validator(key)
			.isDate().withMessage("created_at must be a valid date")
			.custom((value, { req }) => {
				const currentDate = new Date();
				const inputDate = new Date(value);
		  
				if (inputDate > currentDate) {
				  throw new Error("created_at cannot be in the future");
				}
		  
				return true;
			})

	}
}



module.exports = inputValidator;