import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
export async function listGymTrainers() {
    // Public catalog shown to members — only trainers the admin has approved
    // and not deactivated are selectable.
    return prisma.gymTrainer.findMany({
        where: { approved: true, active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
            id: true,
            name: true,
            title: true,
            bio: true,
            imageUrl: true,
            sortOrder: true
        }
    });
}
const MY_TRAINER_PROFILE_SELECT = {
    id: true,
    name: true,
    title: true,
    bio: true,
    imageUrl: true,
    certifications: true,
    specializations: true,
    yearsExperience: true,
    workingHours: true,
    languages: true,
    contactEmail: true,
    contactPhone: true,
    active: true,
    approved: true
};
export async function getMyTrainerProfile(trainerUserId) {
    const profile = await prisma.gymTrainer.findFirst({
        where: { linkedUserId: trainerUserId },
        select: MY_TRAINER_PROFILE_SELECT
    });
    if (!profile)
        throw new HttpError(403, "No trainer profile is linked to this account");
    return profile;
}
export async function updateMyTrainerProfile(trainerUserId, input) {
    const profile = await prisma.gymTrainer.findFirst({ where: { linkedUserId: trainerUserId } });
    if (!profile)
        throw new HttpError(403, "No trainer profile is linked to this account");
    return prisma.gymTrainer.update({
        where: { id: profile.id },
        data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.bio !== undefined ? { bio: input.bio } : {}),
            ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
            ...(input.certifications !== undefined ? { certifications: input.certifications } : {}),
            ...(input.specializations !== undefined ? { specializations: input.specializations } : {}),
            ...(input.yearsExperience !== undefined ? { yearsExperience: input.yearsExperience } : {}),
            ...(input.workingHours !== undefined ? { workingHours: input.workingHours } : {}),
            ...(input.languages !== undefined ? { languages: input.languages } : {}),
            ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
            ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {})
        },
        select: MY_TRAINER_PROFILE_SELECT
    });
}
