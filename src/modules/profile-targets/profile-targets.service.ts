import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";

export async function getProfileTargetsService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      calorieTargetOverride: true,
      proteinTargetOverride: true,
      hydrationTargetOverride: true,
      carbsTargetOverride: true,
      fatTargetOverride: true
    }
  });

  return {
    calorieTargetOverride: user?.calorieTargetOverride ?? null,
    proteinTargetOverride: user?.proteinTargetOverride ?? null,
    hydrationTargetOverride: user?.hydrationTargetOverride ?? null,
    carbsTargetOverride: user?.carbsTargetOverride ?? null,
    fatTargetOverride: user?.fatTargetOverride ?? null
  };
}

export async function updateProfileTargetsService(userId: string, payload: unknown) {
  const p = (payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null) as
    | Record<string, unknown>
    | null;
  if (!p) throw new HttpError(400, "Invalid body");

  const calorieTargetOverride = p.calorieTargetOverride == null ? null : Number(p.calorieTargetOverride);
  const proteinTargetOverride = p.proteinTargetOverride == null ? null : Number(p.proteinTargetOverride);
  const hydrationTargetOverride = p.hydrationTargetOverride == null ? null : Number(p.hydrationTargetOverride);
  const carbsTargetOverride = p.carbsTargetOverride == null ? null : Number(p.carbsTargetOverride);
  const fatTargetOverride = p.fatTargetOverride == null ? null : Number(p.fatTargetOverride);

  if (calorieTargetOverride !== null && (!Number.isFinite(calorieTargetOverride) || !Number.isInteger(calorieTargetOverride)))
    throw new HttpError(400, "Invalid calorieTargetOverride");
  if (proteinTargetOverride !== null && (!Number.isFinite(proteinTargetOverride) || !Number.isInteger(proteinTargetOverride)))
    throw new HttpError(400, "Invalid proteinTargetOverride");
  if (hydrationTargetOverride !== null && !Number.isFinite(hydrationTargetOverride)) throw new HttpError(400, "Invalid hydrationTargetOverride");
  if (carbsTargetOverride !== null && (!Number.isFinite(carbsTargetOverride) || !Number.isInteger(carbsTargetOverride)))
    throw new HttpError(400, "Invalid carbsTargetOverride");
  if (fatTargetOverride !== null && (!Number.isFinite(fatTargetOverride) || !Number.isInteger(fatTargetOverride)))
    throw new HttpError(400, "Invalid fatTargetOverride");

  return await prisma.user.update({
    where: { id: userId },
    data: {
      calorieTargetOverride,
      proteinTargetOverride,
      hydrationTargetOverride,
      carbsTargetOverride,
      fatTargetOverride
    },
    select: {
      calorieTargetOverride: true,
      proteinTargetOverride: true,
      hydrationTargetOverride: true,
      carbsTargetOverride: true,
      fatTargetOverride: true
    }
  });
}
