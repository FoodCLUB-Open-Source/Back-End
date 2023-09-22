import { Router } from "express";

import rateLimiter from "../middleware/rate_limiter.js";
import inputValidator from "../middleware/input_validator.js";

import { setCommentsLike, setLikes, setStoryViews, setViews } from "../dynamo_schemas/dynamo_schemas.js";
import getDynamoRequestBuilder from "../config/dynamoDB.js";

const router = Router();

/* Testing Posts Route */
router.get("/testing", async (req, res) => {
	try {
		res.json({ "Testing": "Working Posts" });
	} catch (err) {
		console.error(err.message);
	}
});

/**
 * Process A Video Like
 * 
 * @route POST /like/:post_id/user/:user_id
 * @param {string} req.params.user_id - The ID of the user liking the video
 * @param {string} req.params.post_id - The ID of the video post being liked
 * @returns {Object} - Returns a status of video like if successful
 * @throws {Error} - If there is an error, the post liking failed
 */
router.post("/like/:post_id/user/:user_id", rateLimiter(), inputValidator, async (req, res, next) => {
	try {
	  const { post_id, user_id } = req.params;
	  const likeSchema = setLikes(parseInt(user_id), parseInt(post_id));
  
	  // Check if the like exists
	  const checkLikeExistence = await getDynamoRequestBuilder("Likes")
		.query("post_id", parseInt(post_id))
		.whereSortKey("user_id")
		.eq(parseInt(user_id))
		.exec();
  
	  if (checkLikeExistence.length === 0) {
		// Like does not exist, proceed to like
		await getDynamoRequestBuilder("Likes").put(likeSchema).exec();
		res.status(200).json({ "Status": "Post Liked" });
	  } else {
		  // Like already exists
		res.status(409).json({ message: "Post Like Already Exists" });
	  }
	} catch (err) {
	  next(err);
	}
  });
  
  /**
   * Remove A Video Like 
   * 
   * @route DELETE /like/:post_id/user/:user_id
   * @param {string} req.params.user_id - The ID of the user deleting the video like
   * @param {string} req.params.post_id - The ID of the video post being unliked
   * @returns {Object} - Returns a status of video like removed if successful
   * @throws {Error} - If there is an error, the post is already unliked
   */
  router.delete("/like/:post_id/user/:user_id", rateLimiter(), inputValidator, async (req, res, next) => {
	try {
	  const { post_id, user_id } = req.params;
  
	  // Check if the like exists
	  const checkLikeExistance = await getDynamoRequestBuilder("Likes")
		.query("post_id", parseInt(post_id))
		.whereSortKey("user_id")
		.eq(parseInt(user_id))
		.exec();
  
	  if (checkLikeExistance && checkLikeExistance.length > 0) {
  
		// Like exists, proceed to delete it
		await getDynamoRequestBuilder("Likes")
		  .delete("post_id", parseInt(post_id))
		  .withSortKey("user_id", parseInt(user_id))
		  .exec();
		res.status(200).json({ "Status": "Post Unliked" });
	  } else {
  
		// Like does not exist
		res.status(404).json({  message: "Post Like Not Found" });
	  }
	} catch (err) {
	  next(err);
	}
  });

/** 
 * Posting a like for a specific comment
 * 
 * @route POST /posts/comment/like/:id
 * @param {string} req.params.id - The ID of the comment being liked
 * @body {string} req.params.post_id - The ID of the post with the comment
 * @body {string} req.params.user_id - The ID of the user liking the comment
 * @returns {Object} - Returns a status of comment like if successful
 * @throws {Error} - If there are errors, the comment liking failed
 */
router.post("/posts/comment/like/:id", rateLimiter(), inputValidator, async (req, res, next) => {
	try {

		const commentId = req.params.id;
		const { user_id, post_id } = req.body;

		const commentLikeSchema = setCommentsLike(parseInt(user_id), commentId);
		
		const putCommentLikesRequest = getDynamoRequestBuilder("Comment_Likes").put(commentLikeSchema);
		
		const updateCommentsRequest = getDynamoRequestBuilder("Comments")
			.update("post_id", parseInt(post_id))
			.withSortKey("comment_id", commentId)
			.updateAttribute("comment_like_count").increment();
		
		await Promise.all([
			putCommentLikesRequest.exec(),
			updateCommentsRequest.exec()
		]);

		res.status(200).json({ "Status": "Comment Liked" });
	} catch (err) {
		next(err);
	}
});

  /**
   * Deleting a like on a specific comment
   * 
   * @route DELETE /like/:post_id/user/:user_id
   * @param {string} req.params.id - The ID of the comment being unliked
   * @body {string} req.params.post_id - The ID of the post with the comment
   * @body {string} req.params.user_id - The ID of the user unliking the comment
   * @returns {Object} Returns a status of comment like removed if successful
   * @throws {Error} If there is an error, the comment unliking failed
   */
router.delete("/posts/comment/like/:id", rateLimiter(), inputValidator, async (req, res, next) => {
	try {
		const commentId = req.params.id;
		const { comment_like_id, post_id } = req.body;
		
		const deleteCommentLikesRequest = getDynamoRequestBuilder("Comment_Likes")
			.delete("comment_like_id", comment_like_id)
			.withSortKey("comment_id", commentId);
		
		const updateCommentsRequest = getDynamoRequestBuilder("Comments")
			.update("comment_id", commentId)
			.withSortKey("post_id", parseInt(post_id))
			.updateAttribute("comment_like_count").decrement();
		
		await Promise.all([
			deleteCommentLikesRequest.exec(),
			updateCommentsRequest.exec()
		]);

		res.status(200).json({ Status: "Comment Unliked" });
	} catch (err) {
		next(err);
	}
});

/**
 * User View A Story
 * This will update the DynamoDB Story_Views Table and process a story view happening
 * @route POST /story:story_id/view:user_id
 * @params 
 *    {string} req.params.story_id - The unique identifier of the story being viewed.
 *    {string} req.params.user_id - The unique identifier of the user who is viewing the story.
**/
router.post("/story/:story_id/view/:user_id", inputValidator, rateLimiter(), async (req, res, next) => {
	try {
		const { story_id, user_id } = req.params;
		const StoryViewSchema = setStoryViews(story_id, parseInt(user_id));

		// Check if the story view exists
		const checkStoryViewExistence = await getDynamoRequestBuilder("Story_Views")
			.query("story_id", story_id)
			.whereSortKey("user_id")
			.eq(parseInt(user_id))
			.exec();

		if (checkStoryViewExistence.length === 0) {
			//Story View does not exist, proceed to View
			await getDynamoRequestBuilder("Story_Views").put(StoryViewSchema).exec();
			res.status(200).json({ "Status": "Story viewed successfully" });
		} else {
			// Story View already exists
			res.status(409).json({  message: "Story already viewed by the user." });
		}
	}
	catch (err) {
		next(err);
	}
});

/** 
 * Update Post View
 * This will update the DynamoDB Views Table and process a view happening
 * @route POST /post:post_id/view:user_id
 * @params 
 *    {string} req.params.post_id - The unique identifier of the post being viewed.
 *    {string} req.params.user_id - The unique identifier of the user who is viewing the post.
 * 
 * @returns {status} - A successful status indicates that the view has been processed successfully.
 * @throws {Error} - If there are errors during processing.
 */
router.post("/post/:post_id/view/:user_id", inputValidator, rateLimiter(), async (req, res, next) => {
	try {
		const { post_id, user_id } = req.params;
		const ViewSchema = setViews(parseInt(user_id), parseInt(post_id));

		// Check if the view exists
		const checkViewExistence = await getDynamoRequestBuilder("Views")
			.query("post_id", parseInt(post_id))
			.whereSortKey("user_id")
			.eq(parseInt(user_id))
			.exec();

		if (checkViewExistence.length === 0) {
			// View does not exist, proceed to View
			await getDynamoRequestBuilder("Views").put(ViewSchema).exec();
			res.status(200).json({ "Status": "Post viewed successfully" });
		} else {
			// View already exists
			res.status(409).json({  message: "Post already viewed by the user." });
		}
	}
	catch (err) {
		next(err);
	}

});

export default router;