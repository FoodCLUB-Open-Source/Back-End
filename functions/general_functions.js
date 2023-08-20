/* File for useful functions to encourage DRY code */
import crypto from "crypto";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

import pgPool from "../pgdb.js";
import s3Client from "../s3Client.js";
import getDynamoRequestBuilder from "../dynamoDB.js";

/* DRY secure postgreSQl query function */
/* Example of how to use: pgQuery("INSERT INTO users (username, age, number) VALUES ($1, $2, $3)", "usernameValue", 25, 42) */
export const pgQuery = async (query, ...inputs) => {
  const pgQuery = {
    text: query,
    values: inputs
  };

  try {
    return await pgPool.query(pgQuery); 
  } catch (err) {
    console.error('Error executing postgreSQL query:', err);
    return { error: `There has been an error performing this query: ${err}` };
  }
};

/* Ensures all queries happen or none at all.
    Example of how to use:
    const query = ['INSERT INTO posts (user_id, post_title, post_description, video_name, thumbnail_name, category_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *', ...]
    const values = [[userId, post_title, post_description, newVideoName, newThumbNaileName, category_id], ...];
    const result = await makeTransaction(query, values)
*/
export const makeTransactions = async (queries, values) => {
  const client = await pgPool.connect();
  
  let res = null;
  
  try {
    await client.query('BEGIN');
    
    for (let i = 0; i < queries.length; i++) {
        res = await client.query(queries[i], values[i]);
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  
  return res;
};

/*DRY upload to s3 function */
export const s3Upload = async (file) => {
  const randomName = file.originalname + crypto.randomBytes(32).toString('hex');

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

/* Retrieves a image from the  bucket via cloudfront */
export const s3Retrieve = (fileName) => getSignedUrl({
  url: process.env.CLOUDFRONT_URL + fileName,
  dateLessThan: new Date(Date.now() + 1000 * 60 * 60 * 24),
  privateKey: process.env.CLOUDFRONT_PK,
  keyPairId: process.env.CLOUDFRONT_KPID
});

/* Deletes a image in the s3 bucket */
export const s3Delete = async (fileName) => {
  const params ={
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
  };

  const s3GetCommand = new DeleteObjectCommand(params);
  await s3Client.send(s3GetCommand);
};

/* Function that takes an array of posts and refines post data using promises to get total post likes count and total post views count. (NEED TO ADD TOTAL COMMENT COUNT ) */
export async function updatePosts(userPosts) {
  const updatedPostsPromises = await userPosts.map(async (post)=> {

    // getting video_name and thumbnail_name URL's, likes and views of the post
    const [videoUrl, thumbnailUrl, postLikeCount, postViewCount] = await Promise.all([
        s3Retrieve(post.video_name),
        s3Retrieve(post.thumbnail_name),
        getDynamoRequestBuilder("Likes").query("post_id", parseInt(post.id)).exec(),
        getDynamoRequestBuilder("Views").query("post_id", parseInt(post.id)).exec()
    ]);
  
    // adding URLs to posts data and removing video_name and thumbnail_name
    post.video_url = videoUrl;
    post.thumbnail_url = thumbnailUrl;
    delete post.video_name;
    delete post.thumbnail_name;
  
    // adding post total likes and views count to posts data
    post.total_likes = postLikeCount.length;
    post.total_views = postViewCount.length;

    return post;
  });

  const updatedPosts = await Promise.all(updatedPostsPromises);

  return updatedPosts;
}