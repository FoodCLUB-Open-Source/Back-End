import { Router } from "express";
import rateLimiter from "../middleware/rate_limiter.js";
import inputValidator from "../middleware/input_validator.js";

import axios from 'axios';

const router = Router();

/**
 * Getting Ingredients for Specific Item
 * 
 * @route GET /search_ingredient/:ingredient
 * @param {string} req.params.ingredient - the string name of the ingredient
 * @returns {Object} An object containing the ingredient information
 * @throws {Error} - If there are errors, the search failed
 */

router.get('/search_ingredient/:ingredient', rateLimiter(), inputValidator, async (req, res, next) => {
  try {
    const { ingredient } = req.params;

    const EDAMAM_APP_ID = '';
    const EDAMAM_APP_KEY = '';

    const response = await axios.get('https://api.edamam.com/api/food-database/v2/parser', {
      params: {
          app_id: EDAMAM_APP_ID,
          app_key: EDAMAM_APP_KEY,
          ingr: ingredient,
          category: 'generic-foods'
      }
    });

    const { hints, _links } = response.data;

    const ingredients = hints.map((hint) => ({
      food_id: hint.food.foodId,
      food_name: hint.food.label,
      image: hint.food.image,
      hints: hint.hints,
      label: hint.measures.map((measure) => measure.label),
    }));

    const nextPageUrl = _links?.next?.href;

    res.json({
      ingredients,
      nextPageUrl,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;