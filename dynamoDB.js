/* Establishing connection to the dynamoDB */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocument } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.DYNAMODB_REGION,
  credentials: {
    accessKeyId: process.env.DYNAMODB_ACCESS_KEY,
    secretAccessKey: process.env.DYNAMODB_SECRECT_ACCESS_KEY,
  },
});

const dynamoDB = DynamoDBDocument.from(client);

module.exports = dynamoDB;