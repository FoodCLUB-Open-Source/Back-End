import { Router } from "express";

import rateLimiter from "../middleware/rate_limiter.js";
import inputValidator from "../middleware/input_validator.js";

import { setCommentsLike, setLikes, setViews } from "../dynamo_schemas/dynamo_schemas.js";
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

/* Posting For Viewing Specific Video */
router.post("/view/:id", rateLimiter(), inputValidator, async (req, res, next) => {
	try {
		const errors = validationResult(req);
  
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const postId = parseInt(req.params.id);
		const { user_id } = req.body;

		const viewSchema = setViews(parseInt(user_id), postId);
		
		const putViewsRequest = getDynamoRequestBuilder("Views").put(viewSchema);
		
		const updatePostStatsRequest = getDynamoRequestBuilder("Post_Stats")
			.update("post_id", postId)
			.updateAttribute("view_count").increment();
		
		await Promise.all([
			putViewsRequest.exec(),
			updatePostStatsRequest.exec()
		]);
		
		console.log("Post Viewed");
		res.json({ Status: "Post Viewed" });
	} catch (err) {
		next(err);
	}
});

//Process A Video Like
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
		res.status(409).json({ "Status": "Post Like Already Exists" });
	  }
	} catch (err) {
	  next(err);
	}
  });
  
  // Remove A Video Like 
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
		res.status(404).json({ "Status": "Post Like Not Found" });
	  }
	} catch (err) {
	  next(err);
	}
  });

/* Posting a like for a specific comment */
router.post("/posts/comment/like/:id", rateLimiter(), inputValidator, async (req, res, next) => {
	try {
		const errors = validationResult(req);
  
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

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

		res.json({ "Status": "Comment Liked" });
	} catch (err) {
		next(err);
	}
});

/* Deleting Like On Specific Comment */
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

		console.log("Comment Unliked");
		res.json({ Status: "Comment Unliked" });
	} catch (err) {
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
router.post("/post/:post_id/view/:user_id", inputValidator, rateLimiter(),  async (req, res, next) => {
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
			res.status(409).json({ "Status": "Post already viewed by the user." });
		}
	    	
	}
	catch (err) {
	  next(err);
	}
  });
export default router;