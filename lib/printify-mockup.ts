/**
 * @purpose Single-shot wrapper: take a generated print artwork URL + a
 *   product shape, run the full Printify pipeline (upload → choose
 *   blueprint/provider/variants → create product → extract mockup), and
 *   return the front-mockup URL.
 *
 * Each call is 4-5 sequential Printify API hits; bake in modest caching so
 * the same upload URL doesn't re-upload (Printify dedupes by hash on their
 * side too, but skipping the network is faster).
 */

import {
  BLUEPRINT_BY_SHAPE,
  PrintifyError,
  createProduct,
  frontMockupUrl,
  getShopId,
  listPrintProvidersForBlueprint,
  listVariants,
  pickRepresentativeVariants,
  uploadImageByUrl,
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

async function uploadOrReuse(printUrl: string, fileName: string): Promise<string> {
  const cached = uploadCache.get(printUrl);
  if (cached) return cached.imageId;
  const upload = await uploadImageByUrl(printUrl, fileName);
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
    const providers = await listPrintProvidersForBlueprint(blueprintId);
    if (providers.length === 0) {
      return { mockupUrl: null, productId: null, error: `no print providers for blueprint ${blueprintId}` };
    }
    const providerId = providers[0].id;

    // 3. Pull variants; pick a small representative subset so the created
    //    product is valid (Printify rejects empty `variants`).
    const variantsResp = await listVariants(blueprintId, providerId);
    const variantIds = pickRepresentativeVariants(variantsResp, 4);
    if (variantIds.length === 0) {
      return { mockupUrl: null, productId: null, error: `no variants for blueprint ${blueprintId} provider ${providerId}` };
    }

    // 4. Create the product. The response carries the rendered mockups.
    const shopId = await getShopId();
    const product = await createProduct({
      shopId,
      blueprintId,
      providerId,
      variantIds,
      printImageId: imageId,
      title: `${req.companyName} — ${req.productName}`,
      description: req.productBlurb,
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
