import express from "express";

import rateLimiter from "../middleware/rate_limiter.js";
import inputValidator from "../middleware/input_validator.js";

import redis from "../config/redisConfig.js";
import { pgQuery } from "../functions/general_functions.js";
import { redisNewRecipe, redisRecipeExists } from "../functions/redis_functions.js";
import { verifyAccessOnly, verifyTokens, verifyUserIdentity } from "../middleware/verify.js";

const router = express.Router();

/* Testing Posts Route */
router.get("/testing", rateLimiter(), async (req, res) => {
  try {
    res.status(200).json({ "Testing": "Working Reipes" });

  } catch (err) {
    console.error(err.message);
  }
});

/**
 * Route handler for getting a specific recipe by ID.
 *  It first checks if the recipe is cached in Redis, if not it fetches from the database and then caches it.
 *  The cached recipe expires after 1 hour.
 * This endpoint needs a request header called 'Authorisation' with the access token
 *
 * @route GET /:id
 * @param {any} *req.params.id - The Id of the post.
 * @returns {status} - If successful, returns 200 and a JSON object with the specific recipe, else returns 404 and a JSON object with error set to 'Recipe not found'
 */
router.get("/:recipe_id", verifyTokens, inputValidator, rateLimiter(), async (req, res, next) => {
  const recipeId = parseInt(req.params.recipe_id);

  try {
    // Fetch recipe from the database
    const specificRecipe = await pgQuery(
      "SELECT * FROM recipes WHERE id = $1",
      recipeId
    );

    // If recipe not found in the database, return 404 error
    if (specificRecipe.rows.length === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Fetch ingredients for the recipe
    let ingredients = await pgQuery(
      "SELECT rp.*, p.label, p.imageurl FROM recipe_products rp JOIN products p ON rp.product_id = p.id WHERE rp.recipe_id = $1",
      recipeId
    );

    // Add ingredients to the recipe object
    specificRecipe.rows[0].recipe_ingredients = ingredients.rows;

    // Fetch categories for the recipe
    let recipeCategories = await pgQuery(
      "SELECT category_name FROM posts_categories WHERE post_id = $1",
      specificRecipe.rows[0].post_id
    );

    // Add categories to the recipe object
    specificRecipe.rows[0].categories = recipeCategories.rows;

    // Return the fetched recipe
    return res.status(200).json({ recipe: specificRecipe.rows[0] });
  } catch (err) {
    console.error(`Error handling request for recipe post ${recipeId}:`, err);
    next(err);
  }
});

/**
 * Route handler for Update Recipes Table.
 * This will update the details in the recipes table.
 * This endpoint needs a request header called 'Authorisation' with both the access token and the ID token
 * 
 * @route PUT /:post_id
 * @param {any} *req.params.post_id - The Id of the post
 * @body 
 * 		 recipe_description = String,
     recipe_ingredients = Array[Tuple[string]],
     recipe_equipment   = Array[string],
     recipe_steps       = Array[string],
     preparation_time   = INTEGER,
     serving_size       = INTEGER,
 * @returns {status} - If successful, returns 200 and a JSON object with message set to 'Recipe updated', else returns 404 and a JSON object with message set to 'Recipe not found'
 */
router.put("/:post_id", inputValidator, verifyUserIdentity, rateLimiter(), async (req, res, next) => {
  try {
    const { post_id } = req.params;

    const {
      recipe_description,
      recipe_ingredients,
      recipe_equipment,
      recipe_steps,
      preparation_time,
      serving_size,
    } = req.body;

    // Check if the recipe with the specified post_id exists
    const checkQuery = "SELECT * FROM recipes WHERE post_id = $1";
    const checkValues = [post_id];
    const existingRecipe = await pgQuery(checkQuery, ...checkValues);

    if (!existingRecipe.rows.length) {
      // If the recipe does not exist, return a "404 Not Found" response
      return res.status(404).json({ message: "Recipe not found" });
    }

    const query = `
		UPDATE recipes 
		SET 
		  recipe_description = $1, 
		  recipe_ingredients = $2, 
		  recipe_equipment = $3, 
		  recipe_steps = $4, 
		  preparation_time = $5, 
		  serving_size = $6,
		  updated_at = NOW()
		WHERE post_id = $7`;

    const values = [
      recipe_description,
      recipe_ingredients,
      recipe_equipment,
      recipe_steps,
      preparation_time,
      serving_size,
      post_id,
    ];

    await pgQuery(query, ...values);

    res.status(200).json({ message: "Recipe updated" });
  } catch (err) {
    next(err);
  }
});

// console.log(await pgQuery("SELECT * FROM posts_categories"))


export default router;