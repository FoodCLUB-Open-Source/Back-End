const { body, check, param } = require('express-validator')


/* Used to validate data being passed to the /posts/postvideo/:id endpoint */
const validatePostVideo = () => {
	return [ 
	  // Sanitize and validate
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
  
	  body('category_id')
		.isInt().withMessage('Category Id should be a number')
		.notEmpty().withMessage('Category Id is required')
		.trim()
		.escape(),
  
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


module.exports = { 
	validatePostVideo,

}