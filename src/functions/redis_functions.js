import { pgQuery } from "./general_functions.js";
import redis from "../config/redisConfig.js";

/**
 * Function to add a new recipe to Redis
 * 
 * @param {*} id - ID of recipe to be queried
 * @throws {Error} - If there is an error adding a recipe to Redis
 */
export async function redisNewRecipe(id) {
  const hashKey = `RECIPE|${id}`;
  try {
    // Query the database to get recipe information to populate redis.
    const queryResult = await pgQuery(
      "SELECT * FROM recipes WHERE id = $1",
      id
    );

    // Check if the recipe data exists
    // we set the field values by getting the keys of each elements in recipe database. We store its value in a strigified balues(REDIS requirememt)
    const recipeData = queryResult.rows[0];

    if (recipeData) {
      const fieldValues = {};
      for (const key in recipeData) {
        if (recipeData.hasOwnProperty(key)) {
          fieldValues[key] = JSON.stringify(recipeData[key]);
        }
      }

      // Use hmset to set multiple fields in Redis and capture the result
      await redis.HSET(hashKey, fieldValues).then(() => {
        const timeToLive = 6400;
        redis.expire(hashKey, timeToLive).then(() => {
          console.log(
            `expiry time has been set for ${timeToLive} seconds for RECIPE ${id}! SUCCESS !`
          );
        });
      });
    } else {
      console.log("Recipe does not exist in PostgresDB");
    }
  } catch (error) {
    console.error(
      "An error occurred while adding a new recipe to Redis:",
      error
    );
    throw error; // Rethrow the error to handle it at a higher level if needed.
  }
}

/**
 * Function to check if a recipe exists in Redis.
 * 
 * @param {*} id - ID of recipe to search for in Redis
 * @returns {object} response - Object with recipe and its associated information 
 * @throws {Error} - If there is an error searching for recipe 
 */
export async function redisRecipeExists(id) {
  const hashKey = `RECIPE|${id}`;
  
  try {
    const result = await redis.HGETALL(hashKey);
    const exists = Object.keys(result).length > 0;

    if (exists) {
      // Convert data types and parse JSON fields
      const response = {
        id: parseInt(result.id),
        post_id: parseInt(result.post_id),
        recipe_description: result.recipe_description,
        recipe_ingredients: JSON.parse(result.recipe_ingredients),
        recipe_equipment: JSON.parse(result.recipe_equipment),
        recipe_steps: JSON.parse(result.recipe_steps),
        preparation_time: parseInt(result.preparation_time),
        serving_size: parseInt(result.serving_size),
        updated_at:result.updated_at,
      };
      return response;
    } else {
      return null; // Returning null to indicate non-existence
    }
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
}

