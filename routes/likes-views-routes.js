import { Router } from "express";
import { validationResult } from "express-validator";

import getDynamoRequestBuilder from "../dynamoDB.js";
import rateLimiter from "../middleware/rate_limiter.js";

import { setCommentsLike, setLikes, setViews } from "../dynamo_schemas/dynamo_schemas.js";
import { validateDeleteComment, validateDeleteLike, validatePostComment, validatePostLike, validatePostView } from "../functions/validators/like_view_validator.js";

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
router.post("/posts/view/:id", rateLimiter(), validatePostView(), async (req, res, next) => {
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

/* Posting For Liking Specific Video */
router.post("/posts/like/:id", rateLimiter(), validatePostLike(), async (req, res, next) => {
	try {
		const errors = validationResult(req);
  
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const postId = parseInt(req.params.id);
		const { user_id } = req.body;

		const likeSchema = setLikes(parseInt(user_id), postId);
		
		const putLikesRequest = getDynamoRequestBuilder("Likes").put(likeSchema);
		
		const updatePostStatsRequest = getDynamoRequestBuilder("Post_Stats")
			.update("post_id", postId)
			.updateAttribute("like_count").increment();
		
		await Promise.all([
			putLikesRequest.exec(),
			updatePostStatsRequest.exec()
		]);
		
		console.log("Post Liked");
		res.json({ Status: "Post Likes" });
	} catch (err) {
		next(err);
	}
});

/* Deleting Like On Specific Video */
router.delete("/posts/like/:id", rateLimiter(), validateDeleteLike(), async (req, res, next) => {
	try {
		const errors = validationResult(req);
  
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const postId = parseInt(req.params.id);
		const { user_id } = req.body;
		
		const updatePostStatsRequest = getDynamoRequestBuilder("Post_Stats")
			.update("post_id", postId)
			.updateAttribute("like_count").decrement();
		
		const deleteLikesRequest = getDynamoRequestBuilder("Likes")
			.delete("post_id", postId)
			.withSortKey("user_id", parseInt(user_id));
		
		await Promise.all([
			updatePostStatsRequest.exec(),
			deleteLikesRequest.exec()
		]);

		console.log("Post Unliked");
		res.json({ Status: "Post Unliked" });
	} catch (err) {
		next(err);
	}
});

/* Posting a like for a specific comment */
router.post("/posts/comment/like/:id", rateLimiter(), validatePostComment(), async (req, res, next) => {
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
router.delete("/posts/comment/like/:id", rateLimiter(), validateDeleteComment(), async (req, res, next) => {
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

export default router;