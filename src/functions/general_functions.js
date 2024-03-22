/* File for useful functions to encourage DRY code */
import crypto from "crypto";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import {
  getSignedUrl
} from "@aws-sdk/s3-request-presigner";

import pgPool from "../config/pgdb.js";
import s3Client from "../config/s3Client.js";
import getDynamoRequestBuilder from "../config/dynamoDB.js";
import {
  error
} from "console";
import { type } from "os";


/**  
 * Function that does a DRY secure postgreSQl query function 
   Example of how to use: 
     pgQuery("INSERT INTO users (username, age, number) VALUES ($1, $2, $3)", "usernameValue", 25, 42) 
 * 
 * @param {any} query - Query statement 
 * @param  {any} inputs - Values to be queried 
 * @returns {any} - Result of query 
 * @throws {Error} - If error performing querys
 */
export const pgQuery = async (query, ...inputs) => {
  const pgQuery = {
    text: query,
    values: inputs
  };

  try {
    return await pgPool.query(pgQuery);
  } catch (err) {
    console.error("Error executing postgreSQL query:", err);
    return { error: `There has been an error performing this query: ${err}` };
  }
};

/** 
* Function that ensures all queries happen or none at all.
    Example of how to use:
     const query = ['INSERT INTO posts (user_id, post_title, post_description, video_name, thumbnail_name, category_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *', ...]
     const values = [[userId, post_title, post_description, newVideoName, newThumbNaileName, category_id], ...];
     const result = await makeTransaction(query, values)
 * 
 * @param {any} queries - Query statements to be processed
 * @param {any} values - Values to be queried 
 * @returns {object} - res object from querying 
 * @throws {Error} - Returns error if a query does not succeed
 */
export const makeTransactions = async (queries, values) => {
  const client = await pgPool.connect();

  let res = null;

  try {
    await client.query("BEGIN");

    for (let i = 0; i < queries.length; i++) {
      res = await client.query(queries[i], values[i]);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return res;
};

/**
 * Function that does a DRY upload to s3 function 
 * 
 * @param {any} file - Original filename to be uploaded
 * @param {any} path - File path to be uploaded
 * @returns {any} randomName - Randomly generated name as key for upload
 */
export const s3Upload = async (file, path) => {
  // Hanldes  if file is not present
  if (!file) {
    throw new Error('File is undefined')
  }

  const randomName = path + file.originalname + crypto.randomBytes(32).toString("hex");

  /* Resize the image to the what is specified (DOESNT WORK WITH VIDEOS) */
  //const buffer = await sharp(file.buffer).resize({height: 1920, width: 1080, fit: "contain"}).toBuffer()

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: randomName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const s3PutCommand = new PutObjectCommand(params);
  await s3Client.send(s3PutCommand);

  return randomName;
};

/** 
 * Function that retrieves an image from s3
 * 
 * @param {any} fileName - Name of file to be retrieved
 * @returns {any} - Signed URL for associated file
 * @throws {Error} - Returns error if issue generating pre-signed URL
 */
export const s3Retrieve = async (fileName) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
    });

    const urlExpiration = 3600;

    const fileUrl = await getSignedUrl(s3Client, command, {
      expiresIn: urlExpiration
    });

    return fileUrl;

  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    throw error;
  }
};

/**
 * Function that deletes an image in the s3 bucket
 * 
 * @param {any} fileNameWithPath - Name of file to be deleted from the S3 bucket
 */
export const s3Delete = async (fileNameWithPath) => {
  try {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileNameWithPath,
    };

    const s3GetCommand = new DeleteObjectCommand(params);
    await s3Client.send(s3GetCommand);

  } catch (error) {
    console.log(error);
  }

};

/**
 * Function that takes an array of posts and refines post data using promises to get total post likes count and total post views count. (NEED TO ADD TOTAL COMMENT COUNT )
 * 
 * @param {Array<object>} userPosts - Array of posts to be udpated
 * @param {any} user_id - ID of user to 
 * @returns {object} post - Refined post object with total views and likes 
 */
export async function updatePosts(userPosts, user_id) {
  const updatedPostsPromises = await userPosts.map(async (post) => {

    // getting video_name and thumbnail_name URL's, likes and views of the post
    const [videoUrl, thumbnailUrl, postLikeCount, postViewCount, isLiked, isViewed] = await Promise.all([
      s3Retrieve(post.video_name),
      s3Retrieve(post.thumbnail_name),
      getDynamoRequestBuilder("Likes").query("post_id", parseInt(post.id)).exec(),
      getDynamoRequestBuilder("Views").query("post_id", parseInt(post.id)).exec(),
      checkLike(post.id, parseInt(user_id)),
      checkView(post.id, parseInt(user_id)),
    ]);

    // adding URLs to posts data and removing video_name and thumbnail_name
    post.video_url = videoUrl;
    post.thumbnail_url = thumbnailUrl;
    delete post.video_name;
    delete post.thumbnail_name;

    // adding post total likes and views count to posts data
    post.total_likes = postLikeCount.length;
    post.total_views = postViewCount.length;

    // Adding isLiked and isViewed fields to posts data
    post.isLiked = isLiked;
    post.isViewed = isViewed;

    return post;
  });

  const updatedPosts = await Promise.all(updatedPostsPromises);

  return updatedPosts;
}

/**
 * Function to check if a post is bookmarked by a user
 * 
 * @param {any} postId - ID of post to be queried
 * @param {any} userId - ID of user to be queried
 * @returns {boolean} - True if post is bookmarked, false otherwise
 */
export const checkBookmarked = async (postId, userId) => {
  const bookmarks = await pgQuery(`
    SELECT TOP 1
    FROM bookmarks b
    WHERE b.post_id = $1 AND b.user_id = $2
  `, postId, userId);

  return bookmarks.rows.length > 0;
};


/**
 * Checks if a user has liked a post or not, returns true or false
 * 
 * @param {any} postId - ID of post to be queried
 * @param {any} userId - ID of user to be queried
 * @returns {boolean} - True if post is liked, false otherwise
 */
export const checkLike = async (postId, userId) => {

  const isLiked = await getDynamoRequestBuilder("Likes")
    .query("post_id", postId)
    .whereSortKey("user_id").eq(userId)
    .exec();

  //if length is 1, means user has liked post hence liked is set to true
  return isLiked.length === 1 ? true : false;
};

/** 
 * Checks if a user has viewed a post or not, returns true or false 
 * 
 * @param {any} postId - ID of post to be queried
 * @param {any} userId - ID of user to be queried
 * @returns {boolean} - True if post is viewed, false otherwise
 */
export const checkView = async (postId, userId) => {

  const isViewed = await getDynamoRequestBuilder("Views")
    .query("post_id", postId)
    .whereSortKey("user_id").eq(userId)
    .exec();

  //if length is 1, means user has viewed post hence viewed is set to true
  return isViewed.length === 1 ? true : false;
};

/** 
* Function to perform batch deletion for a specific DynamoDB table delete the multiple items
   Example of how to use: 
    performBatchDeletion("Likes", [{ post_id: 1, user_id: 1 }, { post_id: 2, user_id: 2 }])
    i-e delete all likes for post_id 1
    const Likes = await getDynamoRequestBuilder("Likes").query("post_id", parseInt(post_id)).exec();
    const likesToDelete = Likes.map((item) =>  ({ post_id: item.post_id, user_id: item.user_id }));
    performBatchDeletion("Likes", likesToDelete)

  same usage for multipe tables
   // Create an array of delete requests for 'Likes' and 'Views' tables
   const deleteRequests = [{ tableName: "Likes", items: likesToDelete }, { tableName: "Views", items: viewsToDelete }];
 
   // Perform batch deletions
   deleteRequests.forEach(async (deleteRequest) => {
   const { tableName, items } = deleteRequest;
   await performBatchDeletion(tableName, items);
  });
 * 
 * @param {any} tableName - Name of DynamoDB table to perform batch deletion on 
 * @param {any} items - 
 */
export const performBatchDeletion = async (tableName, items) => {
  const requestBuilder = getDynamoRequestBuilder(tableName);


  const deletePromises = items.map((item) => {
    const keys = Object.keys(item);

    if (keys.length !== 2) {
      throw new Error("Item does not have exactly 2 keys.");
    }

    const pk = keys[0];
    const sk = keys[1];
    return requestBuilder
      .delete(pk, item.post_id)
      .withSortKey(sk, item.user_id)
      .exec();
  });

  try {
    await Promise.all(deletePromises);
    console.log(`${tableName} deleted successfully.`);
  } catch (error) {
    console.error(`Error deleting ${tableName}:`, error);
  }
};

/**
 * Functions for deleting likes and views of posts
 * 
 * @param {any} post_id - ID of post to have likes and views removed 
 */
export const removeLikesAndViews = async (post_id) => {
  const Likes = await getDynamoRequestBuilder("Likes").query("post_id", parseInt(post_id)).exec();
  const Views = await getDynamoRequestBuilder("Views").query("post_id", parseInt(post_id)).exec();

  // Prepare the list of items to delete from the 'Likes' table
  const likesToDelete = Likes.map((item) => ({
    post_id: item.post_id,
    user_id: item.user_id
  }));

  // Prepare the list of items to delete from the 'Views' table
  const viewsToDelete = Views.map((item) => ({
    post_id: item.post_id,
    user_id: item.user_id
  }));

  // Create an array of delete requests for 'Likes' and 'Views' tables
  const deleteRequests = [{
    tableName: "Likes",
    items: likesToDelete,
  },
  {
    tableName: "Views",
    items: viewsToDelete,
  },
  ];

  // Perform batch deletions
  deleteRequests.forEach(async (deleteRequest) => {
    const { tableName, items } = deleteRequest;
    await performBatchDeletion(tableName, items);
  });

};

export async function stringToUUID(inputString) {
  try {
    // Hash the input string using MD5
    const hash = await crypto.createHash('md5').update(inputString).digest('hex');

    // Convert the hash to UUID format (8-4-4-4-12)
    const uuid = `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20)}`;

    return uuid;

  } catch (err) {
    return {
      error: `There has been an error performing this query`
    };
  }
}

export async function getUserInfo(userData) {
  try {
    let query, userInfo;
    if (typeof (userData) === "number") {
      query = "SELECT id, username, full_name, profile_picture FROM users WHERE id = $1";
    } else {
      query = "SELECT id, username, full_name, profile_picture FROM users WHERE username = $1";
    }

    userInfo = await pgQuery(query, userData);

    if (userInfo.rows.length > 0) {
      if (userInfo.rows[0].profile_picture != null) {
        userInfo.rows[0].profile_picture = await s3Retrieve(userInfo.rows[0].profile_picture);
      }
      return userInfo.rows[0];
    } else {
      return null;
    }
  } catch (err) {
    console.log(err);
    throw err; // Re-throw the error for the caller to handle
  }
}


