// Explainable vegan-compliance verdicts from Open Food Facts — the whole
// point is citing the actual flagged ingredient and why, never a single
// opaque score. Primary signal is OFF's own community-maintained
// per-ingredient `vegan` tags (yes/no/maybe), which are more reliable than
// anything we could derive ourselves from raw text; a small local keyword
// list is only a FALLBACK for the products OFF hasn't fully tagged yet, and
// is always labeled as lower-confidence when used.

const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";
// OFF's API usage guidelines ask for a descriptive User-Agent identifying
// the calling app, to avoid being rate-limited/blocked as anonymous traffic.
const OFF_USER_AGENT = "VeganFit/1.0 (+https://veganfit.example.com) - vegan-compliance-scanner";
const OFF_TIMEOUT_MS = 8000;
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type ScanVerdict = "vegan" | "not-vegan" | "uncertain" | "unknown";

export interface ScanResult {
  barcode: string;
  productName: string | null;
  brand: string | null;
  imageUrl: string | null;
  ingredientsText: string | null;
  verdict: ScanVerdict;
  citedIngredients: string[];
  verdictSource: "off-structured" | "off-tag" | "keyword-fallback" | "no-data";
}

interface OffIngredient {
  id?: string;
  text?: string;
  vegan?: "yes" | "no" | "maybe";
}

interface OffProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  image_front_url?: string;
  ingredients?: OffIngredient[];
  ingredients_text_en?: string;
  ingredients_text?: string;
  ingredients_analysis_tags?: string[];
}

// Definite animal-derived ingredients — a real, cited match here always
// means "not-vegan," never just a downgrade to "uncertain."
const DEFINITE_NON_VEGAN_KEYWORDS = [
  "milk", "whey", "casein", "caseinate", "lactose", "cream", "butter", "ghee",
  "cheese", "yogurt", "yoghurt", "honey", "gelatin", "gelatine", "egg", "albumen",
  "ovalbumin", "beef", "pork", "chicken", "turkey", "lamb", "bacon", "lard",
  "tallow", "suet", "fish", "anchovy", "anchovies", "shrimp", "prawn", "crab",
  "lobster", "oyster", "mussel", "squid", "calamari", "isinglass", "rennet",
  "carmine", "cochineal", "shellac", "beeswax", "royal jelly", "collagen",
  "keratin", "l-cysteine", "duck", "goose", "meat"
];

// Sourcing-ambiguous ingredients — commonly plant-derived but can be
// animal-derived depending on the manufacturer, so a match here is
// "uncertain," never a confident "not-vegan."
const AMBIGUOUS_KEYWORDS = [
  "lecithin", "mono- and diglycerides", "monoglycerides", "diglycerides",
  "natural flavor", "natural flavour", "vitamin d3", "glycerin", "glycerol",
  "lactic acid", "stearic acid", "stearate", "enzyme", "enzymes", "vitamin b12"
];

function matchKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((k) => lower.includes(k));
}

async function fetchOffProduct(barcode: string): Promise<OffProduct | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);
  try {
    const res = await fetch(`${OFF_BASE}/${encodeURIComponent(barcode)}.json`, {
      headers: { "User-Agent": OFF_USER_AGENT },
      signal: controller.signal
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { status?: number; product?: OffProduct };
    if (body.status !== 1 || !body.product) return null;
    return body.product;
  } catch {
    return null; // network error, timeout, or malformed response — treated as "not found," not a crash
  } finally {
    clearTimeout(timeout);
  }
}

function analyzeIngredients(product: OffProduct): Pick<ScanResult, "verdict" | "citedIngredients" | "verdictSource"> {
  const structured = product.ingredients ?? [];
  const nonVegan = structured.filter((i) => i.vegan === "no");
  const maybeVegan = structured.filter((i) => i.vegan === "maybe");

  if (nonVegan.length > 0) {
    return { verdict: "not-vegan", citedIngredients: nonVegan.map((i) => i.text ?? i.id ?? "unlabeled ingredient"), verdictSource: "off-structured" };
  }
  if (maybeVegan.length > 0) {
    return { verdict: "uncertain", citedIngredients: maybeVegan.map((i) => i.text ?? i.id ?? "unlabeled ingredient"), verdictSource: "off-structured" };
  }
  if (structured.length > 0) {
    // OFF tagged every ingredient and none were flagged — a real, confident "vegan."
    return { verdict: "vegan", citedIngredients: [], verdictSource: "off-structured" };
  }

  // No per-ingredient tags at all — fall back to OFF's own top-level
  // analysis tag before trying our own keyword scan, since it may already
  // reflect a community review we can't re-derive from text alone.
  const tags = product.ingredients_analysis_tags ?? [];
  if (tags.includes("en:non-vegan")) {
    return { verdict: "not-vegan", citedIngredients: [], verdictSource: "off-tag" };
  }

  const rawText = product.ingredients_text_en ?? product.ingredients_text ?? null;
  if (!rawText) {
    return { verdict: "unknown", citedIngredients: [], verdictSource: "no-data" };
  }

  const definite = matchKeywords(rawText, DEFINITE_NON_VEGAN_KEYWORDS);
  if (definite.length > 0) {
    return { verdict: "not-vegan", citedIngredients: definite, verdictSource: "keyword-fallback" };
  }
  const ambiguous = matchKeywords(rawText, AMBIGUOUS_KEYWORDS);
  if (ambiguous.length > 0) {
    return { verdict: "uncertain", citedIngredients: ambiguous, verdictSource: "keyword-fallback" };
  }
  // No keyword flagged anything, but this whole path only runs when OFF
  // itself has no structured ingredient data — a keyword scan finding
  // nothing is not the same confidence as OFF confirming every ingredient
  // is vegan, so this stays "uncertain" rather than a confident "vegan."
  return { verdict: "uncertain", citedIngredients: [], verdictSource: "keyword-fallback" };
}

export async function lookupBarcode(barcode: string): Promise<ScanResult | null> {
  const product = await fetchOffProduct(barcode);
  if (!product) return null;

  const analysis = analyzeIngredients(product);

  return {
    barcode,
    productName: product.product_name_en ?? product.product_name ?? null,
    brand: product.brands ?? null,
    imageUrl: product.image_front_url ?? null,
    ingredientsText: product.ingredients_text_en ?? product.ingredients_text ?? null,
    ...analysis
  };
}

export function isCacheFresh(fetchedAt: Date): boolean {
  return Date.now() - fetchedAt.getTime() < CACHE_MAX_AGE_MS;
}
