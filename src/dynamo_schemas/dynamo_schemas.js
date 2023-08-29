/* Schema for the likes for each comment */
import { v4 as uuid } from "uuid";

export const setViews = (userId, postId) => ({
	user_id: userId,
	post_id: postId,
	created_at: new Date().toISOString()
});

export const setLikes = (userId, postId) => ({
	user_id: userId,
	post_id: postId,
	created_at: new Date().toISOString()
});

export const setComment = (userId, postId, comment) => ({
	user_id: userId,
	post_id: postId,
	comment: comment,
	comment_like_count: 0,
	comment_reply_count: 0,
	created_at: new Date().toISOString(),
	updated_at: new Date().toISOString()
});

export const setCommentsLike = (userId, comment_id) => ({
	user_id: userId,
	comment_id: comment_id,
	created_at: new Date().toISOString()
});

export const setReplies = (userId, commentId, reply) => ({
	user_id: userId,
	comment_id: commentId,
	reply: reply,
	created_at: new Date().toISOString(),
	updated_at: new Date().toISOString()
});

export const setStoryViews = (storyId, userId) => ({
	story_id: storyId,
	user_id: userId,
	created_at: new Date().toISOString()
});

export const setStory = (userId, videoUrl, thumbnailUrl) => ({
	story_id: uuid(),
	user_id : userId,
	video_url  : videoUrl,
	thumbnail_url: thumbnailUrl,
	view_count: 0,
	created_at: new Date().toISOString()
});
