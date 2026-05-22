/**
 * Typed wrappers over the Printify API.
 * Server-side: uses PRINTIFY_API_TOKEN directly.
 * Client-side: pass `viaProxy: true` to route through /api/printify/*.
 *
 * Spec: https://developers.printify.com/openapi.json
 */

const PRINTIFY_BASE = 'https://api.printify.com';

export interface PrintifyOptions {
  viaProxy?: boolean;
  signal?: AbortSignal;
}

async function call<T>(
  method: string,
  path: string,
  body: unknown,
  opts: PrintifyOptions = {},
): Promise<T> {
  const { viaProxy = false, signal } = opts;
  const url = viaProxy ? `/api/printify/${path}` : `${PRINTIFY_BASE}/${path}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!viaProxy) {
    const token = process.env.PRINTIFY_API_TOKEN;
    if (!token) throw new Error('PRINTIFY_API_TOKEN not configured');
    headers.Authorization = `Bearer ${token}`;
    headers['User-Agent'] = process.env.PRINTIFY_USER_AGENT ?? 'lmao-merch/1.0';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Printify ${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Shop {
  id: number;
  title: string;
  sales_channel: string;
}

export interface Blueprint {
  id: number;
  title: string;
  description: string;
  brand: string;
  model: string;
  images: string[];
}

export interface PrintProvider {
  id: number;
  title: string;
  location?: Record<string, string>;
}

export interface BlueprintVariant {
  id: number;
  title: string;
  options: Record<string, string | number>;
  placeholders: Array<{
    position: string;
    height: number;
    width: number;
  }>;
}

export interface UploadedImage {
  id: string;
  file_name: string;
  height: number;
  width: number;
  size: number;
  mime_type: string;
  preview_url: string;
  upload_time: string;
}

export interface PrintAreaPlaceholder {
  position: string;
  images: Array<{
    id: string;
    x: number;
    y: number;
    scale: number;
    angle: number;
  }>;
}

export interface PrintArea {
  variant_ids: number[];
  placeholders: PrintAreaPlaceholder[];
  background?: string;
}

export interface CreateProductInput {
  title: string;
  description: string;
  blueprint_id: number;
  print_provider_id: number;
  variants: Array<{
    id: number;
    price: number;
    is_enabled?: boolean;
  }>;
  print_areas: PrintArea[];
  tags?: string[];
}

export interface Product {
  id: string;
  title: string;
  description: string;
  blueprint_id: number;
  print_provider_id: number;
  shop_id: number;
  visible: boolean;
  is_locked: boolean;
  variants: Array<{ id: number; price: number; is_enabled: boolean }>;
  images: Array<{ src: string; variant_ids: number[]; position: string }>;
}

export interface PublishInput {
  title?: boolean;
  description?: boolean;
  images?: boolean;
  variants?: boolean;
  tags?: boolean;
  keyFeatures?: boolean;
  shipping_template?: boolean;
}

// ─── Shops ──────────────────────────────────────────────────────────────────

export const listShops = (opts?: PrintifyOptions) =>
  call<Shop[]>('GET', 'v1/shops.json', undefined, opts);

export const disconnectShop = (shopId: number, opts?: PrintifyOptions) =>
  call<Record<string, never>>('DELETE', `v1/shops/${shopId}/connection.json`, undefined, opts);

// ─── Catalog ────────────────────────────────────────────────────────────────

export const listBlueprints = (opts?: PrintifyOptions) =>
  call<Blueprint[]>('GET', 'v1/catalog/blueprints.json', undefined, opts);

export const getBlueprint = (blueprintId: number, opts?: PrintifyOptions) =>
  call<Blueprint>('GET', `v1/catalog/blueprints/${blueprintId}.json`, undefined, opts);

export const listBlueprintPrintProviders = (blueprintId: number, opts?: PrintifyOptions) =>
  call<PrintProvider[]>(
    'GET',
    `v1/catalog/blueprints/${blueprintId}/print_providers.json`,
    undefined,
    opts,
  );

export const listBlueprintVariants = (
  blueprintId: number,
  printProviderId: number,
  opts?: PrintifyOptions,
) =>
  call<{ variants: BlueprintVariant[] }>(
    'GET',
    `v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
    undefined,
    opts,
  );

export const listPrintProviders = (opts?: PrintifyOptions) =>
  call<PrintProvider[]>('GET', 'v1/catalog/print_providers.json', undefined, opts);

export const getPrintProvider = (printProviderId: number, opts?: PrintifyOptions) =>
  call<PrintProvider>(
    'GET',
    `v1/catalog/print_providers/${printProviderId}.json`,
    undefined,
    opts,
  );

// ─── Uploads ────────────────────────────────────────────────────────────────

export const listUploads = (opts?: PrintifyOptions) =>
  call<{ data: UploadedImage[] }>('GET', 'v1/uploads.json', undefined, opts);

export const getUpload = (imageId: string, opts?: PrintifyOptions) =>
  call<UploadedImage>('GET', `v1/uploads/${imageId}.json`, undefined, opts);

export const uploadImageFromUrl = (
  fileName: string,
  url: string,
  opts?: PrintifyOptions,
) =>
  call<UploadedImage>(
    'POST',
    'v1/uploads/images.json',
    { file_name: fileName, url },
    opts,
  );

export const uploadImageFromBase64 = (
  fileName: string,
  contents: string,
  opts?: PrintifyOptions,
) =>
  call<UploadedImage>(
    'POST',
    'v1/uploads/images.json',
    { file_name: fileName, contents },
    opts,
  );

export const archiveUpload = (imageId: string, opts?: PrintifyOptions) =>
  call<Record<string, never>>(
    'POST',
    `v1/uploads/${imageId}/archive.json`,
    {},
    opts,
  );

// ─── Products ───────────────────────────────────────────────────────────────

export const listProducts = (shopId: number, opts?: PrintifyOptions) =>
  call<{ data: Product[]; current_page: number; last_page: number; total: number }>(
    'GET',
    `v1/shops/${shopId}/products.json`,
    undefined,
    opts,
  );

export const getProduct = (shopId: number, productId: string, opts?: PrintifyOptions) =>
  call<Product>('GET', `v1/shops/${shopId}/products/${productId}.json`, undefined, opts);

export const createProduct = (
  shopId: number,
  input: CreateProductInput,
  opts?: PrintifyOptions,
) =>
  call<Product>('POST', `v1/shops/${shopId}/products.json`, input, opts);

export const updateProduct = (
  shopId: number,
  productId: string,
  input: Partial<CreateProductInput>,
  opts?: PrintifyOptions,
) =>
  call<Product>('PUT', `v1/shops/${shopId}/products/${productId}.json`, input, opts);

export const deleteProduct = (shopId: number, productId: string, opts?: PrintifyOptions) =>
  call<Record<string, never>>(
    'DELETE',
    `v1/shops/${shopId}/products/${productId}.json`,
    undefined,
    opts,
  );

export const publishProduct = (
  shopId: number,
  productId: string,
  input: PublishInput = { title: true, description: true, images: true, variants: true, tags: true },
  opts?: PrintifyOptions,
) =>
  call<Record<string, never>>(
    'POST',
    `v1/shops/${shopId}/products/${productId}/publish.json`,
    input,
    opts,
  );

export const markPublishSucceeded = (
  shopId: number,
  productId: string,
  external: { id: string; handle: string },
  opts?: PrintifyOptions,
) =>
  call<Record<string, never>>(
    'POST',
    `v1/shops/${shopId}/products/${productId}/publishing_succeeded.json`,
    { external },
    opts,
  );

export const markPublishFailed = (
  shopId: number,
  productId: string,
  reason: string,
  opts?: PrintifyOptions,
) =>
  call<Record<string, never>>(
    'POST',
    `v1/shops/${shopId}/products/${productId}/publishing_failed.json`,
    { reason },
    opts,
  );

export const unpublishProduct = (shopId: number, productId: string, opts?: PrintifyOptions) =>
  call<Record<string, never>>(
    'POST',
    `v1/shops/${shopId}/products/${productId}/unpublish.json`,
    {},
    opts,
  );

// ─── Orders ─────────────────────────────────────────────────────────────────

export interface OrderLineItem {
  product_id?: string;
  variant_id: number;
  quantity: number;
  print_provider_id?: number;
  blueprint_id?: number;
  print_areas?: Record<string, string>;
}

export interface OrderAddress {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  country: string;
  region?: string;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
}

export interface SubmitOrderInput {
  external_id: string;
  label?: string;
  line_items: OrderLineItem[];
  shipping_method: number;
  is_printify_express?: boolean;
  send_shipping_notification?: boolean;
  address_to: OrderAddress;
}

export const listOrders = (shopId: number, opts?: PrintifyOptions) =>
  call<{ data: unknown[]; current_page: number; last_page: number }>(
    'GET',
    `v1/shops/${shopId}/orders.json`,
    undefined,
    opts,
  );

export const getOrder = (shopId: number, orderId: string, opts?: PrintifyOptions) =>
  call<unknown>('GET', `v1/shops/${shopId}/orders/${orderId}.json`, undefined, opts);

export const submitOrder = (
  shopId: number,
  input: SubmitOrderInput,
  opts?: PrintifyOptions,
) => call<{ id: string }>('POST', `v1/shops/${shopId}/orders.json`, input, opts);

export const submitExpressOrder = (
  shopId: number,
  input: SubmitOrderInput,
  opts?: PrintifyOptions,
) =>
  call<{ id: string }>('POST', `v1/shops/${shopId}/orders/express.json`, input, opts);

export const calculateOrderShipping = (
  shopId: number,
  input: Pick<SubmitOrderInput, 'line_items' | 'address_to'>,
  opts?: PrintifyOptions,
) =>
  call<{ standard: number; express: number; priority: number; printify_express: number; economy: number }>(
    'POST',
    `v1/shops/${shopId}/orders/shipping.json`,
    input,
    opts,
  );

export const sendOrderToProduction = (
  shopId: number,
  orderId: string,
  opts?: PrintifyOptions,
) =>
  call<unknown>(
    'POST',
    `v1/shops/${shopId}/orders/${orderId}/send_to_production.json`,
    {},
    opts,
  );

export const cancelOrder = (shopId: number, orderId: string, opts?: PrintifyOptions) =>
  call<unknown>('POST', `v1/shops/${shopId}/orders/${orderId}/cancel.json`, {}, opts);

// ─── Webhooks ───────────────────────────────────────────────────────────────

export type WebhookTopic =
  | 'order:created'
  | 'order:updated'
  | 'order:sent-to-production'
  | 'order:shipment:created'
  | 'order:shipment:delivered'
  | 'order:canceled'
  | 'product:deleted'
  | 'product:publish:started'
  | 'shop:disconnected';

export interface Webhook {
  id: string;
  topic: WebhookTopic;
  url: string;
  shop_id: number;
  secret?: string;
}

export const listWebhooks = (shopId: number, opts?: PrintifyOptions) =>
  call<Webhook[]>('GET', `v1/shops/${shopId}/webhooks.json`, undefined, opts);

export const createWebhook = (
  shopId: number,
  input: { topic: WebhookTopic; url: string; secret?: string },
  opts?: PrintifyOptions,
) => call<Webhook>('POST', `v1/shops/${shopId}/webhooks.json`, input, opts);

export const updateWebhook = (
  shopId: number,
  webhookId: string,
  input: { url?: string; secret?: string },
  opts?: PrintifyOptions,
) =>
  call<Webhook>(
    'PUT',
    `v1/shops/${shopId}/webhooks/${webhookId}.json`,
    input,
    opts,
  );

export const deleteWebhook = (shopId: number, webhookId: string, opts?: PrintifyOptions) =>
  call<Record<string, never>>(
    'DELETE',
    `v1/shops/${shopId}/webhooks/${webhookId}.json`,
    undefined,
    opts,
  );

export const simulateWebhook = (shopId: number, webhookId: string, opts?: PrintifyOptions) =>
  call<unknown>(
    'POST',
    `v1/shops/${shopId}/webhooks/${webhookId}/simulate`,
    {},
    opts,
  );
