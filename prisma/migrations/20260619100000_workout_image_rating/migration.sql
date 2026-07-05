-- AlterTable: add optional imageUrl and rating to Workout
ALTER TABLE "Workout" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Workout" ADD COLUMN "rating" DOUBLE PRECISION;
