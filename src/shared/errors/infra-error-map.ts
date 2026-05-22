/**
 * Map infrastructure failures (DB down, Neon asleep, network) to stable API responses.
 */
export function mapInfrastructureError(err: unknown): { status: number; message: string } | null {
  const raw = err instanceof Error ? err.message : String(err);

  if (
    raw.includes("Can't reach database server") ||
    raw.includes("P1001") ||
    raw.includes("PrismaClientInitializationError") ||
    raw.includes("Server has closed the connection") ||
    /ECONNREFUSED.*5432/.test(raw) ||
    /timeout/i.test(raw)
  ) {
    return {
      status: 503,
      message:
        "Database is unavailable. If you use Neon: open the Neon dashboard and resume/wake the project, confirm DATABASE_URL in backend .env matches the active branch, then restart the API server (npm run dev in backend-nodejs)."
    };
  }

  return null;
}
