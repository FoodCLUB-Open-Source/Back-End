import express from "express";

import { pgQuery } from "../functions/general_functions.js";
import rateLimiter from "../middleware/rate_limiter.js";
import inputValidator from "../middleware/input_validator.js";
import Redis from"../redisConfig.js";

const router = express.Router();

/* Testing Posts Route */
router.get("/testing", rateLimiter(4, 15), async (req, res) => {
	try {
	  res.json({ "Testing": "Working Posts" });
  
	} catch (err) {
	  console.error(err.message)
	};
});

/**
 * Route handler for getting a specific recipe by ID.
 * It first checks if the recipe is cached in Redis, if not it fetches from the database and then caches it.
 * The cached recipe expires after 1 hour.
 *
 * @route GET /:id
 * @param {string} *req.params.id - The Id of the post
 * @returns {JSON} The recipe as a JSON object.
 */

router.get("/:id", inputValidator, rateLimiter(), async (req, res, next) => {
	try {

		const recipeId = parseInt(req.params.id);
		const REDIS_KEY = `RECIPE|${recipeId}`;
		
		let redisRecipe = await Redis.json.GET(REDIS_KEY);

		if (!redisRecipe){
			try{
				const specificRecipe = await pgQuery(` 
					SELECT 
					id, post_id, recipe_description, recipe_equipment, recipe_steps, preparation_time, recipe_servings, serving_size
					FROM recipes 
					WHERE id = $1`
					, recipeId
				);

				if (specificRecipe.rows.length === 0) {
					return res.status(404).json({ error: 'Recipe not found' });
				}

				redisRecipe = specificRecipe.rows[0];
				await Redis.multi()
					.json.set(REDIS_KEY, '.', redisRecipe)
					.expire(REDIS_KEY, 60 * 60)
					.exec();
			} catch (err) {
				console.error(`Error fetching recipe ${recipeId}:`, err);
				return next(err);
			};
		};

		res.status(200).json({"recipe": redisRecipe});
  
	} catch (err) {
		console.error(`Error handling request for recipe ${req.params.id}:`, err);
		next(err);
	};
});

export default router;