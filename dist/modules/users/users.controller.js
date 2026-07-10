import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { optionalString, optionalStringArray, requireEmail, requireEnum, requireInt, requireObject, requireString } from "../../shared/validation/validators.js";
import { DIETARY_PREFERENCES, DIETARY_STYLES } from "../../shared/constants/dietary.js";
import { DEFAULT_NOTIFICATION_PREFS, LANGUAGES, NOTIFICATION_PREF_KEYS, UNIT_PREFERENCES } from "../../shared/constants/settings.js";
import { changeUserPassword, deleteUserAccount, getPublicUserById, getUserById, getUserStats, searchUsers, updateUserProfile } from "./users.service.js";
export async function getMe(req, res) {
    const user = await getUserById(req.userId);
    return jsonOk(res, user);
}
export async function getUser(req, res) {
    const isSelf = req.params.id === req.userId;
    const user = isSelf ? await getUserById(req.params.id) : await getPublicUserById(req.params.id);
    if (!user)
        throw new HttpError(404, "User not found");
    return jsonOk(res, user);
}
export async function patchMe(req, res) {
    const body = requireObject(req.body);
    const name = optionalString(body, "name", { trim: true, max: 120 });
    const image = optionalString(body, "image", { trim: true, max: 1000 });
    let email;
    if (body.email != null)
        email = requireEmail(body, "email");
    let gymTrainerId;
    if (body.gymTrainerId === null) {
        gymTrainerId = null;
    }
    else if (body.gymTrainerId !== undefined) {
        gymTrainerId = requireString(body, "gymTrainerId", { trim: true, min: 10, max: 40 });
    }
    let heightCm;
    if (body.heightCm !== undefined && body.heightCm !== null) {
        const v = Number(body.heightCm);
        if (!Number.isFinite(v) || v < 100 || v > 260)
            throw new HttpError(400, "Invalid heightCm");
        heightCm = v;
    }
    let weightKg;
    if (body.weightKg !== undefined && body.weightKg !== null) {
        const v = Number(body.weightKg);
        if (!Number.isFinite(v) || v < 30 || v > 300)
            throw new HttpError(400, "Invalid weightKg");
        weightKg = v;
    }
    let age;
    if (body.age !== undefined && body.age !== null) {
        age = requireInt(body, "age", { min: 12, max: 100 });
    }
    let gender;
    if (body.gender !== undefined && body.gender !== null) {
        gender = requireEnum(body, "gender", ["FEMALE", "MALE", "OTHER"]);
    }
    let activityLevel;
    if (body.activityLevel !== undefined && body.activityLevel !== null) {
        activityLevel = requireEnum(body, "activityLevel", ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "ATHLETE"]);
    }
    let goal;
    if (body.goal !== undefined && body.goal !== null) {
        goal = requireEnum(body, "goal", ["FAT_LOSS", "MUSCLE_BUILD", "LIFESTYLE"]);
    }
    let dietaryStyle;
    if (body.dietaryStyle !== undefined && body.dietaryStyle !== null) {
        dietaryStyle = requireEnum(body, "dietaryStyle", DIETARY_STYLES);
    }
    const dietaryPreferences = optionalStringArray(body, "dietaryPreferences", DIETARY_PREFERENCES);
    let bodyFatPercent;
    if (body.bodyFatPercent !== undefined && body.bodyFatPercent !== null) {
        const v = Number(body.bodyFatPercent);
        if (!Number.isFinite(v) || v < 3 || v > 60)
            throw new HttpError(400, "Invalid bodyFatPercent");
        bodyFatPercent = v;
    }
    let unitPreference;
    if (body.unitPreference !== undefined && body.unitPreference !== null) {
        unitPreference = requireEnum(body, "unitPreference", UNIT_PREFERENCES);
    }
    let language;
    if (body.language !== undefined && body.language !== null) {
        language = requireEnum(body, "language", LANGUAGES);
    }
    let notificationPrefs;
    if (body.notificationPrefs !== undefined && body.notificationPrefs !== null) {
        const raw = requireObject(body.notificationPrefs, "Invalid notificationPrefs");
        const prefs = { ...DEFAULT_NOTIFICATION_PREFS };
        for (const key of NOTIFICATION_PREF_KEYS) {
            if (raw[key] !== undefined && typeof raw[key] !== "boolean") {
                throw new HttpError(400, "Invalid notificationPrefs");
            }
            if (typeof raw[key] === "boolean")
                prefs[key] = raw[key];
        }
        notificationPrefs = prefs;
    }
    const updated = await updateUserProfile(req.userId, {
        name: name == null ? undefined : name,
        email: email == null ? undefined : email,
        image: image == null ? undefined : image,
        gymTrainerId,
        ...(heightCm !== undefined ? { heightCm } : {}),
        ...(weightKg !== undefined ? { weightKg } : {}),
        ...(age !== undefined ? { age } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(activityLevel !== undefined ? { activityLevel } : {}),
        ...(goal !== undefined ? { goal } : {}),
        ...(dietaryStyle !== undefined ? { dietaryStyle } : {}),
        ...(dietaryPreferences !== undefined ? { dietaryPreferences } : {}),
        ...(bodyFatPercent !== undefined ? { bodyFatPercent } : {}),
        ...(unitPreference !== undefined ? { unitPreference } : {}),
        ...(language !== undefined ? { language } : {}),
        ...(notificationPrefs !== undefined ? { notificationPrefs } : {})
    });
    return jsonOk(res, updated);
}
export async function postChangePassword(req, res) {
    const body = requireObject(req.body);
    const newPassword = requireString(body, "newPassword", { min: 8, max: 128 }, "Password must be at least 8 characters");
    const currentPassword = optionalString(body, "currentPassword", { max: 128 });
    const result = await changeUserPassword(req.userId, { currentPassword, newPassword });
    return jsonOk(res, result);
}
export async function postDeleteAccount(req, res) {
    const body = requireObject(req.body);
    const confirmEmail = requireString(body, "confirmEmail", { trim: true, min: 3, max: 320 }, "Type your account email to confirm");
    const result = await deleteUserAccount(req.userId, confirmEmail);
    return jsonOk(res, result);
}
export async function getMeStats(req, res) {
    const stats = await getUserStats(req.userId);
    return jsonOk(res, stats);
}
export async function getUsersSearch(req, res) {
    const searchText = typeof req.query?.q === "string" ? String(req.query.q) : "";
    const requestedLimitRaw = req.query?.limit;
    const requestedLimit = typeof requestedLimitRaw === "string" ? Number(requestedLimitRaw) : typeof requestedLimitRaw === "number" ? requestedLimitRaw : 10;
    const safeLimit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(20, Math.floor(requestedLimit))) : 10;
    const results = await searchUsers(searchText, safeLimit);
    return jsonOk(res, results);
}
