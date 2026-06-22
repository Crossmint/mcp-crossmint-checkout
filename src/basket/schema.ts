import { z } from "zod";

export const CandidateStatusSchema = z.enum([
  "candidate",
  "shortlisted",
  "needs_review",
  "approved",
  "ready_for_checkout",
  "ordered",
  "rejected",
]);

const FlexibleRecordSchema = z.record(z.unknown());
const UrlRecordSchema = z.record(z.string().url());

export const ProductSnapshotSchema = z.object({
  title: z.string().min(1).describe("Human-readable product title."),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  condition: z.enum(["new", "used", "refurbished", "open_box", "unknown"]).optional(),
  merchant: FlexibleRecordSchema.optional().describe("Store, platform, seller, country, and domain metadata."),
  identifiers: z.record(z.string().optional()).optional().describe("URLs, SKU, ASIN, GTIN, UPC, variant IDs, productLocator, crossmintLocator."),
  urls: UrlRecordSchema.optional().describe("Product, canonical, checkout, image, and affiliate URLs."),
  images: z.array(z.object({
    url: z.string().url(),
    type: z.enum(["image", "video", "thumbnail"]).optional(),
    alt: z.string().optional(),
  }).passthrough()).optional(),
  selectedOptions: z.array(FlexibleRecordSchema).optional().describe("Selected variant options such as size, color, storage, delivery plan."),
  attributes: z.array(FlexibleRecordSchema).optional().describe("Structured product specs and attributes."),
  price: FlexibleRecordSchema.optional().describe("current, list, unit, subtotal, shipping, taxEstimate, totalEstimate, discount, coupons."),
  availability: FlexibleRecordSchema.optional().describe("Stock status, limits, restock date, and store message."),
  fulfillment: FlexibleRecordSchema.optional().describe("Shipping, pickup, digital delivery, destination, speed, carrier."),
  policy: FlexibleRecordSchema.optional().describe("Returns, warranty, restrictions, subscription terms, compliance notes."),
  rating: FlexibleRecordSchema.optional().describe("Rating value, scale, count, review summary."),
  evidence: FlexibleRecordSchema.optional().describe("Query, reason, confidence, sources, observed timestamps."),
}).passthrough();

export const CheckoutSchema = z.object({
  provider: z.enum(["crossmint", "merchant", "manual", "unknown"]).optional(),
  locator: z.string().optional().describe("Provider-specific checkout locator."),
  supported: z.boolean().optional(),
  readiness: z.enum(["missing_locator", "needs_validation", "ready", "blocked", "unknown"]).optional(),
  orderId: z.string().optional(),
  lastCheckedAt: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

export const CandidateDecisionSchema = z.object({
  rank: z.number().int().positive().optional(),
  score: z.number().min(0).max(1).optional(),
  rationale: z.string().optional(),
  tradeoffs: z.array(z.string()).optional(),
}).passthrough();

export const CartItemSchema = z.object({
  id: z.string(),
  status: CandidateStatusSchema.default("candidate"),
  quantity: z.number().int().positive().default(1),
  product: ProductSnapshotSchema,
  checkout: CheckoutSchema.optional(),
  decision: CandidateDecisionSchema.optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  comparisonGroupId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  extra: FlexibleRecordSchema.optional(),
}).passthrough();

export const CartItemInputSchema = z.object({
  id: z.string().optional(),
  status: CandidateStatusSchema.optional(),
  quantity: z.number().int().positive().optional(),
  product: ProductSnapshotSchema,
  checkout: CheckoutSchema.optional(),
  decision: CandidateDecisionSchema.optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  comparisonGroupId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  extra: FlexibleRecordSchema.optional(),
}).passthrough();

export const BasketContextSchema = z.object({
  title: z.string().optional(),
  intent: z.string().optional().describe("User shopping/research intent."),
  buyer: z.string().optional(),
  locale: z.string().optional(),
  currency: z.string().min(3).max(3).optional(),
  destinationCountry: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  targetStores: z.array(z.string()).optional(),
}).passthrough();

export const BasketSchema = z.object({
  version: z.literal(1).default(1),
  id: z.string(),
  context: BasketContextSchema.default({}),
  items: z.array(CartItemSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

export const BasketContextInputSchema = BasketContextSchema.extend({
  resetMissingFields: z.boolean().optional(),
}).passthrough();

export type CandidateStatus =
  | "candidate"
  | "shortlisted"
  | "needs_review"
  | "approved"
  | "ready_for_checkout"
  | "ordered"
  | "rejected";

export type Money = Record<string, unknown> & {
  amount?: number;
  currency?: string;
  display?: string;
};

export type ProductSnapshot = Record<string, unknown> & {
  title: string;
  brand?: string;
  merchant?: Record<string, unknown>;
  identifiers?: Record<string, string | undefined>;
  urls?: Record<string, string | undefined>;
  images?: Array<Record<string, unknown> & { url: string }>;
  price?: Record<string, Money | unknown>;
  availability?: Record<string, unknown> & { status?: string };
  evidence?: Record<string, unknown> & {
    reason?: string;
    confidence?: string;
  };
};

export type CheckoutState = Record<string, unknown> & {
  provider?: "crossmint" | "merchant" | "manual" | "unknown";
  locator?: string;
  supported?: boolean;
  readiness?: "missing_locator" | "needs_validation" | "ready" | "blocked" | "unknown";
  orderId?: string;
};

export type CartItem = Record<string, unknown> & {
  id: string;
  status: CandidateStatus;
  quantity: number;
  product: ProductSnapshot;
  checkout?: CheckoutState;
  notes?: string;
  tags?: string[];
  comparisonGroupId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CartItemInput = Record<string, unknown> & {
  id?: string;
  status?: CandidateStatus;
  quantity?: number;
  product: ProductSnapshot;
  checkout?: CheckoutState;
  createdAt?: string;
  updatedAt?: string;
};

export type Basket = Record<string, unknown> & {
  version: 1;
  id: string;
  context: Record<string, unknown> & {
    title?: string;
    intent?: string;
    currency?: string;
  };
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
};

export type BasketContextInput = Record<string, unknown> & {
  title?: string;
  intent?: string;
  buyer?: string;
  locale?: string;
  currency?: string;
  destinationCountry?: string;
  constraints?: string[];
  targetStores?: string[];
  resetMissingFields?: boolean;
};

export const BASKET_MODEL_FIELD_GUIDE = [
  "product.title, brand, category, condition, description",
  "product.merchant.name, domain, url, platform, sellerName",
  "product.identifiers.sourceUrl, canonicalUrl, sku, asin, gtin, variantId, productLocator",
  "product.price.current, list, discount, shipping, taxEstimate, totalEstimate",
  "product.availability.status, quantityAvailable, limitPerCustomer",
  "product.selectedOptions for size/color/storage/etc.",
  "product.fulfillment for shipping, pickup, digital delivery, and destination constraints",
  "product.policy for returns, warranty, restrictions, subscription terms",
  "product.evidence for query, sources, confidence, and why it matches the user intent",
  "checkout.provider, locator, supported, readiness before any real purchase",
];
