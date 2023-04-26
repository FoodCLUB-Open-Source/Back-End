/* File for useful functions to encourage DRY code */
const pool = require("../pgdb")
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")
const s3Client = require("../s3Client")
require('dotenv').config()
const crypto = require("crypto")
const sharp = require("sharp")


/* DRY secure postgreSQl query function */
/* Example of how to use: pgQuery("INSERT INTO users (username, age, number) VALUES ($1, $2, $3)", "usernameValue", 25, 42) */
async function pgQuery (query, ...inputs) {
    const pgQuery = {
        text: query,
        values: inputs
    }
    
    try {
        const queryResult = await pool.query(pgQuery)
        return queryResult
    } catch (err) {
        console.error('Error executing postgreSQL query:', err)
        return {error: `There has been an error performing this query: ${err}`}
    }
}

/*DRY upload to s3 function */
async function s3Upload (file) {
    
    const randomName = file.originalname + crypto.randomBytes(32).toString('hex')

    /* Resize the image to the what is specified */
    //const buffer = await sharp(file.buffer).resize({height: 1920, width: 1080, fit: "contain"}).toBuffer()

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: randomName,
        Body: file.buffer,
        ContentType: file.mimetype,
    }
    
    const s3PutCommand = new PutObjectCommand(params)
    await s3Client.send(s3PutCommand)

    return randomName
}

async function s3Retrieve(fileName) {

    params ={
        Bucket: process.send.S3_BUCKET_NAME,
        Key: fileName,
    }

    const s3GetCommand = new GetObjectCommand(params)
    const url = await getSignedUrl(s3Client, s3GetCommand, { expiresIn: 3600 })
    return url
}

async function s3Delete(fileName) {

    params ={
        Bucket: process.send.S3_BUCKET_NAME,
        Key: fileName,
    }

    const s3GetCommand = new DeleteObjectCommand(params)
    await s3Client.send(s3GetCommand)
}


module.exports = { pgQuery, s3Upload, s3Retrieve, s3Delete }