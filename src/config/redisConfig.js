import { createClient } from "redis";

const redis = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});

try {
  await redis.connect();
  console.log('Successfully connected to Redis');
} catch (err) {
  console.error('Could not connect to Redis:', err);
}

export default redis;