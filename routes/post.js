const express = require("express");
const router = express.Router();
const { pgQuery, s3Retrieve } = require('../functions/general_functions');
const { getItemPrimaryKey, getItemsScan, getItemPartitionKey } = require('../functions/dynamoDB_functions');
const rateLimiter = require('../middleware/rate_limiter');
const { param, validationResult } = require('express-validator');

// middleware to ensure postID is valid
const validatePostId = [
    param('postid').notEmpty().withMessage('Post ID is required.').isInt().withMessage('Post ID must be an integer.'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

/**
 * Retrieves post details of a specific post based off post ID
 * 
 * @route GET /post/:postid
 * @param {string} req.params.postid - The ID of the post to retrieve details for
 * @returns {Object} - An object containing details of the post such as id, title, description, video URL, thumbnail URL, details of user who posted the post, post likes count, post comments count and post view count
 * @throws {Error} - If there is error retrieving post details or validation issues
 */
router.get("/post/:postid", rateLimiter(), validatePostId, async (req, res) => {
    try {
        const postID = parseInt(req.params.postid); // retrieving post ID
        const query = 'SELECT p.id, p.title, p.description, p.video_name, p.thumbnail_name, u.username, u.profile_picture from posts p JOIN users u ON p.user_id = u.id WHERE p.id = $1'; // query to get post details and user who has posted details
        const postDetails = await pgQuery(query, postID);
        const refinedPostDetails = await refinePostsData(postDetails.rows); // further refining posts data
        return res.status(200).json({ data: refinedPostDetails }); // sending data to client
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message }); // server side error
    }
})

/**
 * Function that refines posts data to get video URL and thumbnail URL from s3 bucket. Additionally post comments count, like count and view count details are added
 * 
 * @param {Array} posts - array containing posts 
 * @returns {Array} - array with details refined
 */
async function refinePostsData(posts) {
    for (i = 0; i < posts.length; i++) {
        const post = posts[i]; // retrieving a post

        // getting post details such as ID, video name and thumbnail name
        const postID = post.id;
        const videoName = post.video_name;
        const thumbnailName = post.thumbnail_name;

        // getting video and thumbnail URLs
        const videoURL = await s3Retrieve(videoName);
        const thumbnailURL = await s3Retrieve(thumbnailName);

        // adding video and thumbnail URL's as new attributes and deleting previous attributes
        post.video_url = videoURL;
        post.thumbnail_url = thumbnailURL;
        delete post.video_name;
        delete post.thumbnail_name;

        let params = { // parameter to get post details from Post_Stats table in DynamoDB
            TableName: "Post_Stats",
            KeyConditionExpression: "post_id = :postId",
            ExpressionAttributeValues: {
                ":postId": postID
            },
        }

        // request to Post_Stats table in dynamoDB to get likes count, comments count etc
        const postStats = await getItemPartitionKey(params);

        // adding attributes to post object
        post.comments_count = postStats[0].comments_count;
        post.like_count = postStats[0].like_count;
        post.view_count = postStats[0].view_count;
    }

    return posts;
}

module.exports = router;