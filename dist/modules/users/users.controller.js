import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { optionalString, optionalStringArray, requireEmail, requireEnum, requireInt, requireObject, requireString } from "../../shared/validation/validators.js";
import { DIETARY_PREFERENCES, DIETARY_STYLES, normalizeDietaryPreferences } from "../../shared/constants/dietary.js";
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
    // Trainer assignment is admin-only and always goes through the dedicated
    // PATCH /admin/users/:id/gym-trainer route — never through self-profile
    // edit, even for an admin acting on their own account. Enforced here (not
    // just hidden in the UI); users request a change via /trainer-change-requests.
    if (body.gymTrainerId !== undefined) {
        throw new HttpError(403, "Trainer assignment is admin-only — use the Request Trainer Change form instead");
    }
    let heightCm;
    if (body.heightCm !== undefined && body.heightCm !== null) {
        heightCm = requireInt(body, "heightCm", { min: 50, max: 250 });
    }
    let weightKg;
    if (body.weightKg !== undefined && body.weightKg !== null) {
        const v = Number(body.weightKg);
        if (!Number.isFinite(v) || v < 20 || v > 300)
            throw new HttpError(400, "Invalid weightKg");
        weightKg = v;
    }
    let age;
    if (body.age !== undefined && body.age !== null) {
        age = requireInt(body, "age", { min: 13, max: 100 });
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
    const dietaryPreferences = normalizeDietaryPreferences(optionalStringArray(body, "dietaryPreferences", DIETARY_PREFERENCES));
    let bodyFatPercent;
    if (body.bodyFatPercent !== undefined && body.bodyFatPercent !== null) {
        const v = Number(body.bodyFatPercent);
        if (!Number.isFinite(v) || v < 1 || v > 70)
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
    let goalTargetWeightKg;
    if (body.goalTargetWeightKg === null)
        goalTargetWeightKg = null;
    else if (body.goalTargetWeightKg !== undefined) {
        const v = Number(body.goalTargetWeightKg);
        if (!Number.isFinite(v) || v < 20 || v > 300)
            throw new HttpError(400, "Invalid goalTargetWeightKg");
        goalTargetWeightKg = v;
    }
    let goalTargetBodyFatPercent;
    if (body.goalTargetBodyFatPercent === null)
        goalTargetBodyFatPercent = null;
    else if (body.goalTargetBodyFatPercent !== undefined) {
        const v = Number(body.goalTargetBodyFatPercent);
        if (!Number.isFinite(v) || v < 1 || v > 70)
            throw new HttpError(400, "Invalid goalTargetBodyFatPercent");
        goalTargetBodyFatPercent = v;
    }
    let weeklyWorkoutTarget;
    if (body.weeklyWorkoutTarget === null)
        weeklyWorkoutTarget = null;
    else if (body.weeklyWorkoutTarget !== undefined) {
        weeklyWorkoutTarget = requireInt(body, "weeklyWorkoutTarget", { min: 0, max: 14 });
    }
    let goalTargetDate;
    if (body.goalTargetDate === null)
        goalTargetDate = null;
    else if (body.goalTargetDate !== undefined) {
        const d = new Date(String(body.goalTargetDate));
        if (isNaN(d.getTime()))
            throw new HttpError(400, "Invalid goalTargetDate");
        goalTargetDate = d;
    }
    let goalSetAt;
    if (body.goalSetAt === null)
        goalSetAt = null;
    else if (body.goalSetAt !== undefined) {
        const d = new Date(String(body.goalSetAt));
        if (isNaN(d.getTime()))
            throw new HttpError(400, "Invalid goalSetAt");
        goalSetAt = d;
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
        ...(notificationPrefs !== undefined ? { notificationPrefs } : {}),
        ...(goalTargetWeightKg !== undefined ? { goalTargetWeightKg } : {}),
        ...(goalTargetBodyFatPercent !== undefined ? { goalTargetBodyFatPercent } : {}),
        ...(weeklyWorkoutTarget !== undefined ? { weeklyWorkoutTarget } : {}),
        ...(goalTargetDate !== undefined ? { goalTargetDate } : {}),
        ...(goalSetAt !== undefined ? { goalSetAt } : {})
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
