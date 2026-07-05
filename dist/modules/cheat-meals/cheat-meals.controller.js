import { jsonOk } from "../../shared/http/json-response.js";
import { requireObject, requireString } from "../../shared/validation/validators.js";
import { getCheatMealOptions, selectCheatMeal } from "./cheat-meals.service.js";
export async function postCheatMealSelect(req, res) {
    const body = requireObject(req.body);
    const recipeId = requireString(body, "recipeId", { trim: true, min: 8 });
    const result = await selectCheatMeal(req.userId, recipeId);
    return jsonOk(res, result);
}
export async function getCheatMealOptionsHandler(req, res) {
    const result = await getCheatMealOptions(req.userId);
    return jsonOk(res, result);
}
