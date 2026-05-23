/**
 * @purpose Single-shot wrapper: take a generated print artwork URL + a
 *   product shape, run the full Printify pipeline (upload → choose
 *   blueprint/provider/variants → create product → extract mockup), and
 *   return the front-mockup URL.
 *
 * Each call is 4-5 sequential Printify API hits; the upload step is cached
 * per process so the 6 parallel mockup jobs for a single company never
 * re-encode the same artwork.
 *
 * Builds on top of lib/printify.ts (the typed client) — this file owns
 * the orchestration policy (which blueprint, which provider, which
 * variants), nothing else does.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BLUEPRINT_BY_SHAPE,
  PrintifyError,
  createProduct,
  frontMockupUrl,
  getShopId,
  listBlueprintPrintProviders,
  listBlueprintVariants,
  pickRepresentativeVariants,
  uploadImageFromBase64,
  uploadImageFromUrl,
} from './printify';

export interface MockupRequest {
  shape: keyof typeof BLUEPRINT_BY_SHAPE;
  printUrl: string;
  companyName: string;
  productName: string;
  productBlurb: string;
}

export interface MockupResult {
  mockupUrl: string | null;
  productId: string | null;
  error?: string;
}

const uploadCache = new Map<string, { imageId: string; fileName: string }>();

/**
 * Upload an image to Printify, transparently choosing the right path:
 *
 *   - absolute https URL → upload-by-url (Printify fetches it themselves)
 *   - relative path "/generated/..." → read from public/<path>, upload as
 *     base64 contents (Printify can't reach localhost)
 *
 * Cached by source URL within the same process so the 6 parallel mockup
 * jobs for a single company never re-encode the same artwork.
 */
async function uploadOrReuse(printUrl: string, fileName: string): Promise<string> {
  const cached = uploadCache.get(printUrl);
  if (cached) return cached.imageId;

  let upload;
  if (printUrl.startsWith('http://') || printUrl.startsWith('https://')) {
    upload = await uploadImageFromUrl(fileName, printUrl);
  } else {
    // Relative path — image lives in `public/` on this server.
    const fsPath = join(process.cwd(), 'public', printUrl.replace(/^\//, ''));
    const bytes = await readFile(fsPath);
    const base64 = bytes.toString('base64');
    upload = await uploadImageFromBase64(fileName, base64);
  }
  uploadCache.set(printUrl, { imageId: upload.id, fileName });
  return upload.id;
}

export async function buildMockup(req: MockupRequest): Promise<MockupResult> {
  const blueprintId = BLUEPRINT_BY_SHAPE[req.shape];
  if (!blueprintId) {
    return { mockupUrl: null, productId: null, error: `no blueprint for shape: ${req.shape}` };
  }

  try {
    // 1. Upload (cached)
    const safeName = `${req.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${req.shape}.png`;
    const imageId = await uploadOrReuse(req.printUrl, safeName);

    // 2. Pick the first print provider available for this blueprint.
    //    Different providers carry different variants and quality tiers;
    //    we don't have a preference at this stage so first-available is fine.
    const providers = await listBlueprintPrintProviders(blueprintId);
    if (providers.length === 0) {
      return { mockupUrl: null, productId: null, error: `no print providers for blueprint ${blueprintId}` };
    }
    const providerId = providers[0].id;

    // 3. Pull variants; pick a small representative subset so the created
    //    product is valid (Printify rejects empty `variants`).
    const variantsResp = await listBlueprintVariants(blueprintId, providerId);
    const variantIds = pickRepresentativeVariants(variantsResp, 4);
    if (variantIds.length === 0) {
      return { mockupUrl: null, productId: null, error: `no variants for blueprint ${blueprintId} provider ${providerId}` };
    }

    // 4. Create the product. The response carries the rendered mockups.
    const shopId = await getShopId();
    const product = await createProduct(shopId, {
      title: `${req.companyName} — ${req.productName}`,
      description: req.productBlurb,
      blueprint_id: blueprintId,
      print_provider_id: providerId,
      variants: variantIds.map((id) => ({ id, price: 2999, is_enabled: true })),
      print_areas: [
        {
          variant_ids: variantIds,
          placeholders: [
            {
              position: 'front',
              images: [
                {
                  id: imageId,
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
    });

    return {
      mockupUrl: frontMockupUrl(product),
      productId: product.id,
    };
  } catch (err) {
    const message = err instanceof PrintifyError
      ? `Printify ${err.status ?? ''}: ${err.message}${err.body ? ` — ${err.body.slice(0, 200)}` : ''}`
      : err instanceof Error ? err.message : String(err);
    return { mockupUrl: null, productId: null, error: message };
  }
}
