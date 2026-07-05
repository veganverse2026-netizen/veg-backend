import { prisma } from "../../infrastructure/db/prisma.js";
export async function listGymTrainers() {
    return prisma.gymTrainer.findMany({
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
