import { jsonOk } from "../../shared/http/json-response.js";
import { requireObject, requireString } from "../../shared/validation/validators.js";
import { listSavedRecipes, saveRecipe } from "./recipes.service.js";
export async function getSavedRecipes(req, res) {
    const saved = await listSavedRecipes(req.userId);
    return jsonOk(res, saved);
}
export async function postSaveRecipe(req, res) {
    const body = requireObject(req.body);
    const recipeId = requireString(body, "recipeId", { trim: true, min: 8 });
    const result = await saveRecipe(req.userId, recipeId);
    return jsonOk(res, result);
}
