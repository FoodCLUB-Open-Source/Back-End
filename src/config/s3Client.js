import { S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.S3_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.S3_BUCKET_USER_ACCESS_KEY,
    secretAccessKey: process.env.S3_BUCKET_USER_SECRET_ACESS_KEY
  }
});

export default s3Client;