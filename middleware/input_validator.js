/* Input validation for all Endpoints */

const { body, check, param, query, validationResult } = require('express-validator')
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const { validateGetCategoryPost } = require('../functions/validators/posts_validators');


const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/*This will do the validation and recurse if an array or object */
const validateAndSanitize = async (key, value, req, source) => {

	let validator;

	if (source === "body") {validator = body}
	else if (source === "query") {validator = query}
	else if (source === "params") {validator = param};

    if (typeof(value) === "string"){
        let sanitized = DOMPurify.sanitize(value);
        sanitized = sanitized.replace(/\0/g, '');
		
        await validator(key)
            .isLength({min: 1, max: 500}).withMessage(`${key} value must be between 2 and 300 characters long`)
            .trim()
            .customSanitizer(() => sanitized)
            .run(req);
    }

    else if (typeof(value) === "number" || typeof(value) === "float" || typeof(value) === "boolean"){
        await validator(key)
            .exists().withMessage("The inputted value must exist")
            .run(req);
    }

    else if (Array.isArray(value)) {
        for(let i = 0; i < value.length; i++) {
            await validateAndSanitize(`${key}[${i}]`, value[i], req, source);
        }
    }

    else if (typeof(value) === 'object' && value !== null && !(value instanceof Array)) {
        for(const property in value) {
            if (value.hasOwnProperty(property)) {
                await validateAndSanitize(`${key}.${property}`, value[property], req, source);
            }
        }
    }
}

const inputValidator = () => {    
    return async (req, res, next) => {
        let validationErrors = [];

        if (Object.keys(req.body).length !== 0) {
            for (const [key, value] of Object.entries(req.body)){
                await validateAndSanitize(key, value, req, "body");
				await validateFrequent(key, req, "body");
            }
        }

		if (Object.keys(req.query).length !== 0) {
            for (const [key, value] of Object.entries(req.query)){
                await validateAndSanitize(key, value, req, "query");
				await validateFrequent(key, req, "query");
            }
        }

		if (Object.keys(req.params).length !== 0) {
            for (const [key, value] of Object.entries(req.params)){
                await validateAndSanitize(key, value, req, "params");
				await validateFrequent(key, req, "params");
            }
        }

		
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			validationErrors = errors.array();
			return res.status(422).json({ errors: validationErrors });
		}

        next();
    }
}

const validateFrequent = async (key, req, source) => {
	let validator;

	if (source === "body") {validator = body}
	else if (source === "query") {validator = query}
	else if (source === "params") {validator = param};

	//numeric IDs
	if (key === "user_id" || key === "post_id" || key === "recipe_id") {
		await validator(key)
			.exists().withMessage(`${key} is required`)
			.isInt().withMessage(`${key} is not a number`)
			.isPositive().withMessage(`${key} cannot be negative`)
			.toInt()
			.run(req);
	} else if (key === "post_id_user_id"){

	} else if (key === "post_id_created_at"){

	} else if (key === "comment_id_user_id"){

	} else if (key === "email"){
		await validator(key)
			.exists().withMessage('Email is required')
			.isEmail().withMessage("Must be a valid email address")
			.normalizeEmail()
			.isLength({ min: 5, max: 100 }).withMessage('Email must be between 5 and 100 characters')
			.run(req);
	} else if (key === "password"){
		await validator(key)
			.exists().withMessage('Password is required')
			.isLength({ min: 5 }).withMessage('Password must be at least 8 characters long')
			.matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,1024}$/)
			.withMessage('Password must have at least one uppercase letter, one lowercase letter, one number, and one special character')
			.run(req);
	} else if (key === "phonenumber"){
		await validator(key)
			.exists().withMessage('Phonenumber is required')
			.isMobilePhone().withMessage('Must be a valid mobile phone number')
			.isLength({ min: 4, max: 15 }).withMessage('Phone number length must be between 4 and 15')
			.matches(/^\+?[1-9]\d{1,14}$/).withMessage('Must be a valid international phone number')
			.run(req);
	} else if (key === "username") {
		await validator(key)
			.exists().withMessage('Username is required')
			.isLength({ min: 2, max: 30 }).withMessage('Username must be between 2 and 30 characters long')
			.isAlphanumeric().withMessage('Username must only contain letters and numbers')
			.run(req);
	} else if (key === "gender") {
		await validator(key)
			.exists().withMessage('Gender is required')
  			.isIn(['male', 'female', 'non-binary']).withMessage('Gender must be either male, female, or non-binary')
			.run(req);
	} else if (key === "user_bio" || key === "description") {
		await validator(key)
			.exists().withMessage('Bio is required')
			.isLength({ min: 0, max: 150 }).withMessage('Username must be between 0 and 150 characters long')
			.run(req);
	}
}



module.exports = inputValidator;