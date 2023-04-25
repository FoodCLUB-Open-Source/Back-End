import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

import dotenv from 'dotenv'

dotenv.config()

const s3Client = new S3Client({
    region: process.env.AWS_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})

export default s3Client