`types.ts` in this folder is auto-generated from `prisma/schema.prisma` (`npm run prisma:generate`, or plain `npx prisma generate`) via `prisma-generator-typescript-interfaces`. It's plain TS interfaces/unions — no `@prisma/client` runtime dependency — so it's safe to drop into a repo that doesn't have Prisma installed.

It is the canonical source of truth for model shapes shared with the frontend and mobile apps.

## Workflow

1. After changing `prisma/schema.prisma` and running a migration, run `npm run prisma:generate`.
2. Commit the updated `types.ts` here.
3. Copy it into:
   - `VeganFit_Next-Frontend/src/types/backend.generated.ts`
   - `veganverse-mobile/src/types/backend.generated.ts`
4. Fix any resulting type errors in the app code that consumed the old shape — that's the point: they're supposed to surface now, not silently drift.

This is a manual copy, not a build-time import — there's no monorepo linking the three repos. The win over the previous state is that there's one generated file to diff against instead of three independently hand-guessed ones.
