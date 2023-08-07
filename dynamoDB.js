/* Establishing connection to the dynamoDB */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

import DynamoRequestBuilderCreator from "@foodclubdevelopment/dynamo-request-builder";

const client = new DynamoDBClient({
  region: process.env.DYNAMODB_REGION,
  credentials: {
    accessKeyId: process.env.DYNAMODB_ACCESS_KEY,
    secretAccessKey: process.env.DYNAMODB_SECRECT_ACCESS_KEY,
  },
});

export const dynamoDB = DynamoDBDocument.from(client);

const requestBuilderCreator = new DynamoRequestBuilderCreator(dynamoDB);

const getDynamoRequestBuilder = (tableName) => requestBuilderCreator.create(tableName);

export default getDynamoRequestBuilder;