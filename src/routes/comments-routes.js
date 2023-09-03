import { Router } from "express";
import { update } from "@foodclubdevelopment/dynamo-request-builder/attributes";

import getDynamoRequestBuilder from "../config/dynamoDB.js";
import rateLimiter from "../middleware/rate_limiter.js";

import { setComment, setReplies } from "../dynamo_schemas/dynamo_schemas.js";

const router = Router();

/* Testing Posts Route */
router.get("/testing", async (req, res) => {
	try {
	  res.json({ "Testing": "Working Comments" });
	} catch (err) {
	  console.error(err.message);
	}
});

/**
 * Posting Comment For Specific Post
 * 
 * @route POST  /posts/comments/:id
 * @param {string} req.params.id - The ID of the post with the comment
 * @body {string} req.params.user_id - The ID of the user commenting on the post
 * @body {string} req.params.comment - The ID of the comment being posted
 * @returns {Object} - Returns a status of comment if posted successfully
 * @throws {Error} - If there are errors, the comment posting failed
 */
router.post("/posts/comments/:id", rateLimiter(),  async (req, res, next) => {
	try {
		const postId = parseInt(req.params.id);
		const { user_id, comment } = req.body;

		const commentSchema = setComment(user_id, postId, comment);
		
		await getDynamoRequestBuilder("Comments")
			.put(commentSchema)
			.exec();
		
		await getDynamoRequestBuilder("Post_Stats")
			.update("post_id", postId)
			.updateAttribute("comments_count").increment()
			.exec();

		console.log("Comment Posted");
		res.json({ "Status": "Comment Posted" });
	} catch (err) {
		next(err);
	}
});

/**
 * Getting 30 most liked Comments For Specific Post
 * 
 * @route GET /posts/comments/:id
 * @param {string} req.params.id - The ID of the post with the 30 most liked comments
 * @returns {Object} - Returns a JSON Object of the results from the query
 * @throws {Error} - If there are errors, retrieving 30 most liked comments failed
 */
router.get("/posts/comments/:id", rateLimiter(), async (req, res, next) => {
	try {
		const postId = parseInt(req.params.id);

		//return the user details aswell
		//maybe make it so that the user that is requesting the comments. his comments are first.
		const results = await getDynamoRequestBuilder("Comments")
			.query("post_id", postId)
			.useIndex("post_id_comment_like_count_index")
			.scanIndexDescending()
			.limit(30)
			.exec();

		console.log(results);

		console.log("Comments Fetched");
		res.json({ "Testing": "Working Posts", "Results": results });
	} catch (err) {
	  next(err);
	}
});


/** 
 * Update Comment For Specific Post
 * 
 * @route PUT /posts/comments/:id
 * @param {string} req.params.id - The ID of the comment getting updated
 * @body {string) req.body.comment - The comment to replace the original comment
 * @body {string} req.body.post_id - The ID of the post with the comment
 * @returns {Object} - Returns a status of comment if update is successful
 * @throws {Error} - If there are errors, the comment update failed
 */ 
router.put("/posts/comments/:id", rateLimiter(), async (req, res, next) => {
	try {
		const commentId = req.params.id;
		const { comment, post_id } = req.body;
		
		await getDynamoRequestBuilder("Comments")
			.update("post_id", post_id)
			.withSortKey("comment_id", commentId)
			.operations(update("comment").set(comment), update("updated_at").set(new Date().toISOString()))
			.exec();

		console.log("Comment Updated");
		res.json({ Status: "Comment Updated" });
	} catch (err) {
		next(err);
	}
});

/**
 * Delete Comment For Specific Post 
 * 
 * @route DELETE /posts/comments/:id
 * @param {string} req.params.id - The ID of teh comment getting deleted
 * @body {string} req.body.post_id - The ID of the post with the comment
 * @returns {Object} - Returns a status of  the comment deletion if successful
 * @throws {Error} - If there are errors, the comment deletion failed
 */
router.delete("/posts/comments/:id", rateLimiter(), async (req, res, next) => {
	try {
		let commentId = req.params.id;
		let { post_id } = req.body;
		post_id = parseInt(post_id);
		
		await getDynamoRequestBuilder("Comments")
			.delete("post_id", post_id)
			.withSortKey("comment_id", commentId)
			.exec();
		
		await getDynamoRequestBuilder("Post_Stats")
			.update("post_id", post_id)
			.updateAttribute("comments_count").decrement()
			.exec();

		console.log("Comment Deleted");
		res.json({ Status: "Comment Deleted" });
	} catch (err) {
		next(err);
	}
});

/** get 20 Replies For Specific Comment
 * 
 * @route GET /posts/comments/replies/:id
 * @param {string} req.params.id - The ID of the comment with 20 replies
 * @returns {Object} - Returns a JSON object of the 20 replies for the comment if successful
 * @throws {Error} If there is an error, the retrieval of the 20 replies failed
 */
router.get("/posts/comments/replies/:id", rateLimiter(),  async (req, res, next) => {
	try {
		const commentId = req.params.id;

		//return the user details aswell
		//maybe make it so that the user that is requesting the comments. his comments are first.

		const results = await getDynamoRequestBuilder("Replies")
			.query("comment_id", commentId)
			.useIndex("comment_id-created_at-index")
			.scanIndexDescending()
			.limit(20)
			.exec();

		console.log("Comments Fetched");
		res.json({ "Testing": "Working Posts", "Results": results });
	} catch (err) {
		next(err);
	}
});

/** Posting Reply For Specific Comment
 * 
 * @route POST /posts/comments/replies/:id
 * @param {string} req.params.commentId - The comment that is getting replied to
 * @body {string} req.body.user_id - The user replying to the comment
 * @body {string} req.body.post_id - The post containing the comment
 * @body {string} req.body.reply - The reply being posted
 * @returns {Object} - Returns a status of the reply if successful
 * @throws {Error} - If there is an error, the reply failed
 */
router.post("/posts/comments/replies/:id", rateLimiter(),  async (req, res, next) => {
	try {
		let commentId = req.params.id;
		const { user_id, post_id, reply } = req.body;

		const replySchema = setReplies(user_id, commentId, reply);
		
		await getDynamoRequestBuilder("Replies")
			.put(replySchema)
			.exec();
		
		await getDynamoRequestBuilder("Comments")
			.update("post_id", post_id)
			.withSortKey("comment_id", commentId)
			.updateAttribute("comment_reply_count").increment()
			.exec();

		console.log("Reply Posted");
		res.json({ "Status": "Reply Posted" });
	} catch (err) {
		next(err);
	}
});

/** update Reply For Specific Comment
 * 
 * @route PUT /posts/comments/replies/:id
 * @param {string} req.params.id - The ID of the reply getting updated
 * @body {string} req.body.reply - The reply that is replacing the old one
 * @body {string} req.body.comment_id - The comment with the reply
 * @returns {Object} - Returns a status of the reply if update is successful
 * @throws {Error} - If there is an error, the reply update failed
 */
router.put("/posts/comments/replies/:id", rateLimiter(),  async (req, res, next) => {
	try {
		const replyId = req.params.id;
		const { reply, comment_id } = req.body;
		
		await getDynamoRequestBuilder("Replies")
			.update("reply_id", replyId)
			.withSortKey("comment_id", comment_id)
			.operations(update("reply").set(reply), update("updated_at").set(new Date().toISOString()))
			.exec();

		console.log("Reply Updated");
		res.json({ Status: "Reply Updated" });
	} catch (err) {
		next(err);
	}
});

/** Delete Reply For Specific Comment
 * 
 * @route DELETE /posts/comments/replies/:id
 * @param {string} req.params.id - The ID of the reply getting deleted
 * @body {string} req.body.comment_id - The ID of the comment with the reply
 * @body {string} req.body.post_id - The ID of the post with the comment
 * @returns {Object} - Returns a status of whether the deletion of the reply was successful
 * @throws {Error} - If there is an error, the reply deletion failed
 */
router.delete("/posts/comments/replies/:id", rateLimiter(),  async (req, res, next) => {
	try {
		let replyId = req.params.id;
		const { comment_id, post_id } = req.body;

		console.log(comment_id, post_id, replyId);
		
		await getDynamoRequestBuilder("Replies")
			.delete("reply_id", replyId)
			.withSortKey("comment_id", comment_id)
			.exec();
		
		await getDynamoRequestBuilder("Comments")
			.update("post_id", post_id)
			.withSortKey("comment_id", comment_id)
			.updateAttribute("comment_reply_count").decrement()
			.exec();

		console.log("Reply Deleted");
		res.json({ Status: "Reply Deleted" });
	} catch (err) {
		next(err);
	}
});

export default router;