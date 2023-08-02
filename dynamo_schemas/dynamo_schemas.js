/* Schema for the likes for each comment */
const { v4: uuidv4 } = require('uuid');

function setViews(userId, postId) {
	return {
		user_id: userId,
		post_id: postId,
		created_at: new Date().toISOString(),
	};
};

function setLikes(userId, postId) {
	return {
		user_id: userId,
		post_id: postId,
		created_at: new Date().toISOString(),
	};
};

function setComment(userId, postId, comment) {
	return {
		user_id: userId,
		post_id: postId,
		comment: comment,
		comment_like_count: 0,
		comment_reply_count: 0,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};
};

function setCommentsLike(userId, comment_id) {
	return {
		user_id: userId,
		comment_id: comment_id,
		created_at: new Date().toISOString(),
	};
};

function setReplies(userId, commentId, reply) {
	return {
		user_id: userId,
		comment_id: commentId,
		reply: reply,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};
};

function setStoryViews() {
	return{
		story_id: storyId,
		user_id: userId,
		created_at: new Date().toISOString()
	};
};

function setStory(userId, videoUrl, thumbnailUrl) {
	return {
		story_id: uuidv4(),
		user_id : userId,
		video_url  : videoUrl,
		thumbnail_url: thumbnailUrl,
		view_count: 0,
		created_at: new Date().toISOString(),
	};
};

function setPostStats(postId) {
	return {
		post_id: postId,
		like_count: 0,
		view_count:0,
		comments_count:0
	}
}

function setUserStats(postId) {
	return {
		user_id: postId,
		follower_count: 0,
		following_count: 0,
		likes_count: 0
	};
};

module.exports = { 
	setViews, 
	setLikes, 
	setComment, 
	setReplies, 
	setCommentsLike, 
	setStoryViews, 
	setStory,
	setPostStats,
	setUserStats
};