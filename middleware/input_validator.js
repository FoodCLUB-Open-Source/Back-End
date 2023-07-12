/* Input validation for all Endpoints */

const { body, check, param, query, validationResult } = require('express-validator')
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');


const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/*This will do the validation */
const inputValidator = () => {    
    return async (req, res, next) => {

		//const variable = '<img src=\"x\" onerror=\"alert(XSS Attack)\" />'
		
		if (Object.keys(req.body).length !== 0) {
			for (const [key, value] of Object.entries(req.body)){
				console.log(value, typeof(value))
				if (typeof(value) === "string"){

					let sanitized = DOMPurify.sanitize(value);
					sanitized = sanitized.replace(/\0/g, '');

					body(key)
					.isLength({min: 2, max: 300}).withMessage(`${key} value must be between 2 and 300 characters long`)
					.trim()
					.customSanitizer(() => sanitized);

				}

				if ((typeof(value) === "number") || typeof(value) === "float"){

					body(key)
					.exists().withMessage("The number inputted must exist")

				}


			}
		}

		next()
	}
}

/* This is what checks whether there are any errors with the validation*/
const inputErrorHandler = () => {    
    return async (req, res, next) => {

		const errors = validationResult(req)

		if (errors.isEmpty()) {
			return next()
		}
		
		const extractedErrors = []
		errors.array().map(err => extractedErrors.push({ [err.param]: err.msg }))

		return res.status(422).json({
			errors: extractedErrors,
		})

	}
}

module.exports = {
	inputErrorHandler,
	inputValidator
};