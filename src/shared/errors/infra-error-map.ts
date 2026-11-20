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
    // Only Prisma's own pool timeout — a bare /timeout/ also matched SMTP and
    // HTTP timeouts and mislabelled them as database outages.
    raw.includes("P2024") ||
    raw.includes("Timed out fetching a new connection from the connection pool")
  ) {
    return {
      status: 503,
      message:
        process.env.NODE_ENV === "production"
          ? "Service temporarily unavailable. Please try again shortly."
          : "Database is unavailable. If you use Neon: open the Neon dashboard and resume/wake the project, confirm DATABASE_URL in backend .env matches the active branch, then restart the API server (npm run dev in backend-nodejs)."
    };
  }

  return null;
}
