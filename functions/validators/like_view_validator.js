import { body, param } from "express-validator";

/* Validates functions that require a number Id */
export const validatePostView = () => [
	param('id')
		.isInt().withMessage('Id should be a number')
		.notEmpty().withMessage('Id is required')
		.trim()
		.escape(),
	
	body('user_id')
		.isInt().withMessage('User Id Should Be A Number')
		.notEmpty().withMessage('User Id is required')
		.trim()
		.escape(),
];

/* Validates functions that require a number Id */
export const validatePostLike = () => [
	param('id')
		.isInt().withMessage('Id should be a number')
		.notEmpty().withMessage('Id is required')
		.trim()
		.escape(),
	
	body('user_id')
		.isInt().withMessage('User Id Should Be A Number')
		.notEmpty().withMessage('User Id is required')
		.trim()
		.escape(),
];

/* Validates /likes_view/deletelike/:id */
export const validateDeleteLike = () => [
	param('id')
		.isInt().withMessage('Id should be a number')
		.notEmpty().withMessage('Id is required')
		.trim()
		.escape(),
	
	body('user_id')
		.isInt().withMessage('User Id Should Be A Number')
		.notEmpty().withMessage('User Id is required')
		.trim()
		.escape(),
];

/* Validates /likes_view/deletelike/:id */
export const validatePostComment = () => [
	param('id')
		.notEmpty().withMessage('Id is required')
		.trim()
		.escape(),
	
	body('user_id')
		.isInt().withMessage('User Id Should Be A Number')
		.notEmpty().withMessage('User Id is required')
		.trim()
		.escape(),

	body('post_id')
		.isInt().withMessage('Post Id Should Be A Number')
		.notEmpty().withMessage('Post Id is required')
		.trim()
		.escape(),
];

/* Validates /likes_view/deletecommentlike/:id */
export const validateDeleteComment = () => [
	param('id')
		.isInt().withMessage('Id should be a number')
		.notEmpty().withMessage('Id is required')
		.trim()
		.escape(),
	
	body('comment_like_id')
		.notEmpty().withMessage('Comment Like Id is required')
		.trim()
		.escape(),

	body('post_id')
		.isInt().withMessage('Post Id Should Be A Number')
		.notEmpty().withMessage('Post Id is required')
		.trim()
		.escape(),
];