import { body, check, param, query } from "express-validator";

/* Validates functions that require a number Id */
export const validateParamId = () => [
	param('id')
		.isInt().withMessage('Id should be a number')
		.notEmpty().withMessage('Id is required')
		.trim()
		.escape(),
];

/* Used to validate data being passed to the /posts/postvideo/:id endpoint */
export const validatePostVideo = () => [ 
	param('id')
		.isInt().withMessage('User Id should be a number')
		.notEmpty().withMessage('User Id is required')
		.trim()
		.escape(),

	body('post_title')
		.notEmpty().withMessage('Post Title is required')
		.isLength({ max:100 }).withMessage("Post Title Cannot Exceed 100 Characters")
		.trim()
		.escape(),

	body('post_description')
		.notEmpty().withMessage('Post Description is required')
		.isLength({ max: 500 }).withMessage("Post Description Cannot Exceed 500 Characters")
		.trim()
		.escape(),

	body('recipe_description')
		.notEmpty().withMessage('Recipe description is required')
		.isLength({ max:100 }).withMessage("Recipe description Cannot Exceed 100 Characters")
		.trim()
		.escape(),

	body('recipe_preparation_time')
		.isInt().withMessage("Recipe preparation must be a number")
		.notEmpty().withMessage('Recipe preparation is required')
		.trim()
		.escape(),

	body('recipe_serving')
		.isInt().withMessage("Recipe servings must be a number")
		.notEmpty().withMessage('Recipe servings is required')
		.trim()
		.escape(),

	body('category_id_list')
		.custom((value) => {
			let hashtagIds;
			try {
				hashtagIds = JSON.parse(value);
			} catch (error) {
				throw new Error('Invalid hashtag_id_list format');
			}
			
			if (!Array.isArray(hashtagIds) || hashtagIds.length === 0) {
				throw new Error('hashtag_id_list should not be empty and must be an array');
			}
			
			if (!hashtagIds.every(Number.isInteger)) {
				throw new Error('hashtag Ids should be integers');
			}
			
			return true;
	}),

	body('hashtag_id_list')
		.custom((value) => {
			let hashtagIds;
			try {
				hashtagIds = JSON.parse(value);
			} catch (error) {
				throw new Error('Invalid hashtag_id_list format');
			}
			
			if (!Array.isArray(hashtagIds) || hashtagIds.length === 0) {
				throw new Error('hashtag_id_list should not be empty and must be an array');
			}
			
			if (!hashtagIds.every(Number.isInteger)) {
				throw new Error('hashtag Ids should be integers');
			}
			
			return true;
	}),

	body('recipe_steps')
	.custom((value) => {
		let recipeSteps;
		try {
			recipeSteps = JSON.parse(value);
		} catch (error) {
			throw new Error('Invalid recipe steps format');
		}
		
		if (!Array.isArray(recipeSteps) || recipeSteps.length === 0) {
			throw new Error('Recipe steps should not be empty and must be an array');
		}
		
		return true;
	}),

	body('recipe_ingredients')
	.custom((value) => {
		let recipeIngredients;
		try {
			recipeIngredients = JSON.parse(value);
		} catch (error) {
			throw new Error('Invalid recipe ingredients format');
		}
		
		if (!Array.isArray(recipeIngredients) || recipeIngredients.length === 0) {
			throw new Error('recipe ingredients should not be empty and must be an array');
		}
		
		return true;
	}),

	body('recipe_equipment')
	.custom((value) => {
		let recipeEquipment;
		try {
			recipeEquipment = JSON.parse(value);
		} catch (error) {
			throw new Error('Invalid recipe equipment format');
		}
		
		if (!Array.isArray(recipeEquipment) || recipeEquipment.length === 0) {
			throw new Error('Recipe equipment should not be empty and must be an array');
		}
		
		return true;
	}),

	check('files')
	.custom((value, { req }) => {
		if (!req.files || req.files.length !== 2) {
			throw new Error('A video file and a thumbnail file are required');
		}

		// Ensure one file is an image and the other is a video
		const fileTypes = req.files.map(file => file.mimetype);
		const isOneImageOneVideo = 
		(fileTypes.includes('video/mp4') && 
		(fileTypes.includes('image/jpeg') || fileTypes.includes('image/png')));

		if (!isOneImageOneVideo) {
			throw new Error('One file must be a video (mp4) and one file must be an image (jpeg or png)');
		}

		// Ensures file size is within limit
		// for (let file of req.files) {
		// 	if (file.size > MAX_FILE_SIZE) {
		// 		throw new Error('File size exceeds the maximum limit');
		// 	}
		// } 
		return true;
	})
]

/* Used to validate posts/getpost/:id */
export const validateGetPost = () => [ 
	param('id')
		.isInt().withMessage('Post Id should be a number')
		.notEmpty().withMessage('Post Id is required')
		.trim()
		.escape(),

	query('user_id')
		.isInt().withMessage('User Id should be a number')
		.notEmpty().withMessage('User Id is required')
		.trim()
		.escape(),
];

/* Used to validate posts/getposts*/
export const validateGetPosts = () => [ 
	query('user_id')
		.isInt().withMessage('User Id should be a number')
		.notEmpty().withMessage('User Id is required')
		.trim()
		.escape(),
];

/* Used to validate posts/getpost/:id */
export const validateGetCategoryPost = () => [ 
	param('id')
		.notEmpty().withMessage('Category Id is required')
		.trim()
		.escape(),

	query('user_id')
		.isInt().withMessage('User Id should be a number')
		.notEmpty().withMessage('User Id is required')
		.trim()
		.escape(),
];

/* Used to validate posts/category/:id */
export const validateCategory = () => [
	param('id')
		.notEmpty().withMessage('Category Id is required')
		.trim()
		.escape(),
];

