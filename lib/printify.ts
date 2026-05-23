/**
 * @purpose Typed wrappers around the Printify REST API.
 *   Spec: https://developers.printify.com/openapi.json
 *
 * Server-only — needs PRINTIFY_API_TOKEN. PRINTIFY_SHOP_ID is also expected;
 * fetched lazily from /v1/shops.json if absent.
 *
 * We use Printify's product-creation pipeline to get real mockup photos:
 *   1. POST /v1/uploads/images.json  — upload print artwork, returns image_id
 *   2. POST /v1/shops/{shop_id}/products.json — create product with blueprint,
 *      print_provider, variants, and print_areas referencing the upload.
 *      The response carries `mockups: [{ src: "https://…", position: "front" }]`.
 *      That's the photo we display.
 *
 * Each product takes ~5-15s to create + mockup. Six products in parallel
 * keeps the wall-clock reasonable but Printify rate-limits at 600/min so
 * concurrent companies on the same key can hit that ceiling.
 */

const PRINTIFY_BASE = 'https://api.printify.com';

class PrintifyError extends Error {
  constructor(message: string, public status?: number, public body?: string) {
    super(message);
    this.name = 'PrintifyError';
  }
}

function token(): string {
  const t = process.env.PRINTIFY_API_TOKEN;
  if (!t) throw new PrintifyError('PRINTIFY_API_TOKEN env var is not set');
  return t;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token()}`,
    'User-Agent': process.env.PRINTIFY_USER_AGENT ?? 'lmao-merch/1.0',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${PRINTIFY_BASE}/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new PrintifyError(`Printify ${method} ${path} → ${res.status}`, res.status, text);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Types we actually use ──────────────────────────────────────────────────

export interface PrintifyShop {
  id: number;
  title: string;
  sales_channel: string;
}

export interface PrintifyUpload {
  id: string;          // upload image_id used in print_areas
  file_name: string;
  height: number;
  width: number;
  size: number;
  mime_type: string;
  preview_url: string;
  upload_time: string;
}

export interface PrintifyMockupImage {
  src: string;
  position?: string;
  variant_ids?: number[];
  is_default?: boolean;
}

export interface PrintifyProduct {
  id: string;
  title: string;
  description: string;
  images: PrintifyMockupImage[];
  variants: Array<{ id: number; sku: string; price: number; is_enabled: boolean }>;
}

interface BlueprintVariantsResponse {
  id: number;
  title: string;
  variants: Array<{
    id: number;
    title: string;
    options: Record<string, number>;
    placeholders: Array<{ position: string; height: number; width: number }>;
  }>;
}

interface PrintProvider {
  id: number;
  title: string;
}

// ── Endpoints ──────────────────────────────────────────────────────────────

export async function listShops(): Promise<PrintifyShop[]> {
  return call<PrintifyShop[]>('GET', 'v1/shops.json');
}

/**
 * Memoized shop ID resolver. Reads PRINTIFY_SHOP_ID first; otherwise asks
 * Printify for the first shop on the account.
 */
let cachedShopId: number | null = null;
export async function getShopId(): Promise<number> {
  if (cachedShopId !== null) return cachedShopId;
  const envId = process.env.PRINTIFY_SHOP_ID;
  if (envId && /^\d+$/.test(envId)) {
    cachedShopId = Number(envId);
    return cachedShopId;
  }
  const shops = await listShops();
  if (shops.length === 0) {
    throw new PrintifyError('No Printify shops on this account — create one at https://printify.com/app/store and set PRINTIFY_SHOP_ID');
  }
  cachedShopId = shops[0].id;
  return cachedShopId;
}

/**
 * Upload an image to Printify by absolute HTTPS URL. Returns the image_id
 * used in print_areas references when creating a product.
 *
 * Printify requires a publicly-reachable HTTPS URL on this path. Use
 * `uploadImageByContents` when the image lives only on the local server
 * (which is the dev-server / `public/generated/…` case).
 */
export async function uploadImageByUrl(url: string, fileName: string): Promise<PrintifyUpload> {
  return call<PrintifyUpload>('POST', 'v1/uploads/images.json', {
    file_name: fileName,
    url,
  });
}

/**
 * Upload an image to Printify by base64-encoded contents. Use this when
 * the image is local-only (Printify can't fetch a localhost URL). The
 * field name is `contents` per Printify docs.
 */
export async function uploadImageByContents(base64: string, fileName: string): Promise<PrintifyUpload> {
  return call<PrintifyUpload>('POST', 'v1/uploads/images.json', {
    file_name: fileName,
    contents: base64,
  });
}

export async function listPrintProvidersForBlueprint(blueprintId: number): Promise<PrintProvider[]> {
  return call<PrintProvider[]>('GET', `v1/catalog/blueprints/${blueprintId}/print_providers.json`);
}

export async function listVariants(blueprintId: number, providerId: number): Promise<BlueprintVariantsResponse> {
  return call<BlueprintVariantsResponse>(
    'GET',
    `v1/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`,
  );
}

export interface CreateProductInput {
  shopId: number;
  blueprintId: number;
  providerId: number;
  /** A representative subset of variant IDs to enable on the created product. */
  variantIds: number[];
  /** The uploaded image_id to render in the front print area. */
  printImageId: number | string;
  title: string;
  description: string;
}

export async function createProduct(input: CreateProductInput): Promise<PrintifyProduct> {
  const body = {
    title: input.title,
    description: input.description,
    blueprint_id: input.blueprintId,
    print_provider_id: input.providerId,
    variants: input.variantIds.map((id) => ({ id, price: 2999, is_enabled: true })),
    print_areas: [
      {
        variant_ids: input.variantIds,
        placeholders: [
          {
            position: 'front',
            images: [
              {
                id: input.printImageId,
                x: 0.5,
                y: 0.5,
                scale: 1,
                angle: 0,
              },
            ],
          },
        ],
      },
    ],
  };
  return call<PrintifyProduct>('POST', `v1/shops/${input.shopId}/products.json`, body);
}

/**
 * Front-of-product mockup URL extracted from a created PrintifyProduct.
 * Falls back to the first image if no `front` is tagged.
 */
export function frontMockupUrl(product: PrintifyProduct): string | null {
  const front = product.images.find((m) => m.position === 'front' && m.is_default);
  if (front) return front.src;
  const anyFront = product.images.find((m) => m.position === 'front');
  if (anyFront) return anyFront.src;
  return product.images[0]?.src ?? null;
}

/**
 * Pick a representative variant subset from a blueprint × provider listing.
 * Most blueprints have dozens of variants (size × color combinations); we
 * just need a handful to create a valid product and get a mockup.
 * Strategy: take the first variant of each unique color option.
 */
export function pickRepresentativeVariants(resp: BlueprintVariantsResponse, max = 6): number[] {
  const seenColors = new Set<number>();
  const picks: number[] = [];
  for (const v of resp.variants) {
    const color = v.options?.color ?? v.options?.colors;
    const key = color ?? v.id;
    if (seenColors.has(key)) continue;
    seenColors.add(key);
    picks.push(v.id);
    if (picks.length >= max) break;
  }
  if (picks.length === 0 && resp.variants[0]) picks.push(resp.variants[0].id);
  return picks;
}

/** Blueprint IDs we use for each merch product shape.
 *  These are conventional Printify catalog IDs that map to common
 *  print-on-demand items. If a specific blueprint isn't available on
 *  the account's connected provider, the product creation will fail
 *  with a 404 — the caller handles that as a missing mockup (the SVG
 *  fallback shows instead).
 */
export const BLUEPRINT_BY_SHAPE: Record<string, number> = {
  tee: 6,        // Unisex Heavy Cotton Tee (Gildan 5000)
  hoodie: 77,    // Unisex Heavy Blend Hooded Sweatshirt (Gildan 18500)
  mug: 19,       // White Glossy Mug 11oz
  sticker: 1066, // Kiss-Cut Stickers
  tote: 1207,    // Eco Tote Bag (Liberty Bags / similar)
  poster: 5,     // Premium Luster Photo Paper Poster
};

export { PrintifyError };
