import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { lookupBarcode, isCacheFresh, type ScanResult, type ScanVerdict } from "../../shared/domain/veganScanner.js";

const SCAN_HISTORY_PAGE_SIZE = 50;

function toScanResult(row: {
  barcode: string;
  productName: string | null;
  brand: string | null;
  imageUrl: string | null;
  ingredientsText: string | null;
  verdict: string;
  citedIngredients: unknown;
  verdictSource: string;
}): ScanResult {
  return {
    barcode: row.barcode,
    productName: row.productName,
    brand: row.brand,
    imageUrl: row.imageUrl,
    ingredientsText: row.ingredientsText,
    verdict: row.verdict as ScanVerdict,
    citedIngredients: Array.isArray(row.citedIngredients) ? (row.citedIngredients as string[]) : [],
    verdictSource: row.verdictSource as ScanResult["verdictSource"]
  };
}

export async function scanBarcode(userId: string, barcodeRaw: string): Promise<ScanResult> {
  const barcode = barcodeRaw.trim();
  if (!/^\d{6,14}$/.test(barcode)) {
    throw new HttpError(400, "That doesn't look like a real barcode");
  }

  const cached = await prisma.scannedProductCache.findUnique({ where: { barcode } });

  let result: ScanResult;
  if (cached && isCacheFresh(cached.fetchedAt)) {
    result = toScanResult(cached);
  } else {
    const fresh = await lookupBarcode(barcode);
    if (!fresh) {
      // Open Food Facts doesn't have this product (or is unreachable) — if
      // we have a stale cached entry, better to serve it than nothing.
      if (cached) {
        result = toScanResult(cached);
      } else {
        throw new HttpError(404, "We couldn't find that product — it may not be in Open Food Facts' database yet");
      }
    } else {
      result = fresh;
      await prisma.scannedProductCache.upsert({
        where: { barcode },
        create: {
          barcode,
          productName: result.productName,
          brand: result.brand,
          imageUrl: result.imageUrl,
          ingredientsText: result.ingredientsText,
          verdict: result.verdict,
          citedIngredients: result.citedIngredients,
          verdictSource: result.verdictSource
        },
        update: {
          productName: result.productName,
          brand: result.brand,
          imageUrl: result.imageUrl,
          ingredientsText: result.ingredientsText,
          verdict: result.verdict,
          citedIngredients: result.citedIngredients,
          verdictSource: result.verdictSource,
          fetchedAt: new Date()
        }
      });
    }
  }

  await prisma.userProductScan.create({ data: { userId, barcode } });

  return result;
}

export async function listScanHistory(userId: string) {
  const scans = await prisma.userProductScan.findMany({
    where: { userId },
    orderBy: { scannedAt: "desc" },
    take: SCAN_HISTORY_PAGE_SIZE,
    include: { product: true }
  });

  return scans.map((s) => ({
    scannedAt: s.scannedAt,
    ...toScanResult(s.product)
  }));
}
