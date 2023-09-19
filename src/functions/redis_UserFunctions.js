//return true or false depending if the key can be found
export async function checkUserExists(redisClient, id) {
    try {
        const hashKey = `USER|${id}`;
        const response = await redisClient.HGETALL(hashKey);
        const result = Object.keys(response);

        if (result.length > 0) {
            return response;
        } else {
            return false;
        }
    } catch (error) {
        // Handle errors, e.g., log them or take appropriate action.
        console.error("An error occurred while querying Redis:", error);
        return false; // Return a default value or handle errors as needed.
    }

}

export async function addNewUser(redisClient, id) {
        const hashKey = `USER|${id}`;
        // Define the hash key and field-value pair
        const fieldValues = {
            username: 'value1',
            profile: 'value2',
            user_posts: '[]'
        };
        // Use the hmset method to set multiple fields
        redisClient.HSET(hashKey, fieldValues, (error, result) => {
            if (error) {
                console.error('Error setting multiple fields:', error);
            } else {
                console.log('Multiple fields set successfully.');
            }
        })
    

}