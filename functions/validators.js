const { body, check, param, query } = require('express-validator')


/* Used to validate data being passed to the /posts/postvideo/:id endpoint */
const validatePostVideo = () => {
	return [ 
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

			// Ensure file size is within limit
			// for (let file of req.files) {
			// 	if (file.size > MAX_FILE_SIZE) {
			// 		throw new Error('File size exceeds the maximum limit');
			// 	}
			// } 
			return true;
		}),
	]
}

const validateGetPost = () => {
	return [ 
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
	]
}


module.exports = { 
	validatePostVideo,
	validateGetPost,

}