/* Schema for the likes for each comment */
const { v4: uuidv4 } = require('uuid');

function setViews(userId, postId) {
	return {
		view_id: uuidv4(),
		user_id: userId,
		post_id: postId,
		created_at: new Date().toISOString(),
	}
}

function setLikes(userId, postId) {
	return {
		like_id: uuidv4(),
		user_id: userId,
		post_id: postId,
		created_at: new Date().toISOString(),
	}
}

function setComment(userId, postId, comment) {
	return {
		comment_id: uuidv4(),
		user_id: userId,
		post_id: postId,
		comment: comment,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	}
}

function setReplies(userId, commentId, reply) {
	return {
		reply_id: uuidv4(),
		user_id: userId,
		comment_id: commentId,
		reply: reply,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	}
}

function setCommentsLike(userId, comment_id) {
	return {
		comment_like_id: uuidv4(),
		user_id: userId,
		comment_id: comment_id,
		created_at: new Date().toISOString(),
	}
}

function setFollow(userId, followingId) {
	return {
		follow_id: uuidv4(),
		follower_id : userId,
		following_id : followingId,
		created_at: new Date().toISOString(),
	}
}

function setStory(userId, videoUrl, thumbnailUrl) {
	return {
		story_id: uuidv4(),
		user_id : userId,
		video_url  : videoUrl,
		thumbnail_url: thumbnailUrl,
		created_at: new Date().toISOString(),
	}
}

function setTotalLikes(postId) {
	return {
		post_id: postId,
		like_count: 0,
	}
}

function setTotalViews(postId) {
	return {
		post_id: postId,
		view_count: 0,
	}
}


module.exports = { 
	setViews, 
	setLikes, 
	setComment, 
	setReplies, 
	setCommentsLike, 
	setFollow, 
	setStory,
	setTotalLikes,
	setTotalViews
}