import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BasketContextInput,
  BasketContextInputSchema,
  Basket,
  BasketSchema,
  CandidateStatus,
  CandidateStatusSchema,
  CartItem,
  CartItemInput,
  CartItemInputSchema,
} from "./schema.js";

const DEFAULT_BASKET_DIR = ".crossmint-agent-basket";
const DEFAULT_BASKET_FILE = "basket.json";

type CompactMoney = {
  amount?: number;
  currency?: string;
  display?: string;
};

export function resolveBasketStorePath(): string {
  return path.resolve(
    process.env.CROSSMINT_BASKET_STORE_PATH ||
      path.join(process.cwd(), DEFAULT_BASKET_DIR, DEFAULT_BASKET_FILE)
  );
}

export function resolveBasketViewerPort(): number {
  const raw = process.env.CROSSMINT_BASKET_PORT || process.env.PORT || "4377";
  const port = Number.parseInt(raw, 10);
  return Number.isFinite(port) && port > 0 ? port : 4377;
}

export function getBasketViewerUrl(port = resolveBasketViewerPort()): string {
  const host = process.env.CROSSMINT_BASKET_PUBLIC_HOST || `http://localhost:${port}`;
  return host.replace(/\/$/, "");
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultBasket(): Basket {
  const now = nowIso();
  return {
    version: 1,
    id: "default",
    context: {},
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

function checkoutLocatorFor(item: Pick<CartItem, "product" | "checkout">): string | undefined {
  return (
    item.checkout?.locator ||
    item.product.identifiers?.crossmintLocator ||
    item.product.identifiers?.productLocator
  );
}

function normalizeCheckout(input: CartItemInput, existing?: CartItem): CartItem["checkout"] {
  const locator =
    input.checkout?.locator ||
    input.product.identifiers?.crossmintLocator ||
    input.product.identifiers?.productLocator ||
    existing?.checkout?.locator;

  const supportedByLocator = locator?.startsWith("amazon:") || locator?.startsWith("shopify:");

  return {
    ...existing?.checkout,
    ...input.checkout,
    provider: input.checkout?.provider || existing?.checkout?.provider || (locator ? "crossmint" : "unknown"),
    locator,
    supported: input.checkout?.supported ?? existing?.checkout?.supported ?? supportedByLocator ?? undefined,
    readiness:
      input.checkout?.readiness ||
      existing?.checkout?.readiness ||
      (locator ? "needs_validation" : "missing_locator"),
  };
}

function normalizeItem(input: CartItemInput, existing?: CartItem): CartItem {
  const parsed = CartItemInputSchema.parse(input) as CartItemInput;
  const createdAt = existing?.createdAt || parsed.createdAt || nowIso();

  return {
    ...existing,
    ...parsed,
    id: parsed.id || existing?.id || randomUUID(),
    status: parsed.status || existing?.status || "candidate",
    quantity: parsed.quantity || existing?.quantity || 1,
    product: parsed.product,
    checkout: normalizeCheckout(parsed, existing),
    createdAt,
    updatedAt: nowIso(),
  };
}

function compactItem(item: CartItem) {
  const price = moneyFrom(item.product.price?.current || item.product.price?.totalEstimate);
  return {
    id: item.id,
    status: item.status,
    quantity: item.quantity,
    title: item.product.title,
    brand: item.product.brand,
    merchant: item.product.merchant,
    url: item.product.urls?.product || item.product.identifiers?.sourceUrl,
    image: item.product.images?.[0]?.url || item.product.urls?.image,
    price,
    availability: item.product.availability?.status,
    locator: checkoutLocatorFor(item),
    checkout: item.checkout,
    reason: item.product.evidence?.reason,
    confidence: item.product.evidence?.confidence,
    updatedAt: item.updatedAt,
  };
}

function moneyFrom(value: unknown): CompactMoney | undefined {
  return value != null && typeof value === "object" ? value as CompactMoney : undefined;
}

export function summarizeBasket(basket: Basket) {
  const statuses = basket.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  const totalsByCurrency = basket.items.reduce<Record<string, number>>((acc, item) => {
    const money = moneyFrom(item.product.price?.totalEstimate || item.product.price?.current);
    if (money?.amount == null) {
      return acc;
    }
    const currency = money.currency || basket.context.currency || "USD";
    acc[currency] = (acc[currency] || 0) + money.amount * item.quantity;
    return acc;
  }, {});

  const checkoutReady = basket.items.filter((item) => {
    const statusReady = item.status === "approved" || item.status === "ready_for_checkout";
    return statusReady && checkoutLocatorFor(item) != null;
  }).length;

  return {
    id: basket.id,
    context: basket.context,
    itemCount: basket.items.length,
    statuses,
    checkoutReady,
    missingCheckoutLocator: basket.items.filter((item) => checkoutLocatorFor(item) == null).length,
    totalsByCurrency,
    updatedAt: basket.updatedAt,
    items: basket.items.map(compactItem),
  };
}

export class BasketStore {
  constructor(private readonly filePath = resolveBasketStorePath()) {}

  path(): string {
    return this.filePath;
  }

  async load(): Promise<Basket> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const json = JSON.parse(raw);
      return BasketSchema.parse(json) as Basket;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const basket = defaultBasket();
        await this.save(basket);
        return basket;
      }
      throw error;
    }
  }

  async save(basket: Basket): Promise<Basket> {
    const parsed = BasketSchema.parse({
      ...basket,
      updatedAt: nowIso(),
    }) as Basket;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    await rename(tmpPath, this.filePath);
    return parsed;
  }

  async setContext(input: BasketContextInput): Promise<Basket> {
    const parsed = BasketContextInputSchema.parse(input) as BasketContextInput;
    const { resetMissingFields, ...context } = parsed;
    const basket = await this.load();
    return this.save({
      ...basket,
      context: resetMissingFields ? context : { ...basket.context, ...context },
    });
  }

  async upsertItem(input: CartItemInput): Promise<{ basket: Basket; item: CartItem; created: boolean }> {
    const basket = await this.load();
    const index = input.id ? basket.items.findIndex((item) => item.id === input.id) : -1;
    const existing = index >= 0 ? basket.items[index] : undefined;
    const item = normalizeItem(input, existing);
    const items = [...basket.items];

    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }

    const saved = await this.save({ ...basket, items });
    return { basket: saved, item, created: index < 0 };
  }

  async updateStatus(id: string, status: CandidateStatus): Promise<CartItem | null> {
    const parsedStatus = CandidateStatusSchema.parse(status) as CandidateStatus;
    const basket = await this.load();
    const item = basket.items.find((candidate) => candidate.id === id);
    if (item == null) {
      return null;
    }
    item.status = parsedStatus;
    item.updatedAt = nowIso();
    await this.save(basket);
    return item;
  }

  async removeItem(id: string): Promise<boolean> {
    const basket = await this.load();
    const nextItems = basket.items.filter((item) => item.id !== id);
    if (nextItems.length === basket.items.length) {
      return false;
    }
    await this.save({ ...basket, items: nextItems });
    return true;
  }

  async clear(): Promise<Basket> {
    const basket = await this.load();
    return this.save({ ...basket, items: [] });
  }

  async exportCrossmintLineItems(itemIds?: string[]) {
    const basket = await this.load();
    const selected = basket.items.filter((item) => {
      const selectedById = itemIds == null || itemIds.length === 0 || itemIds.includes(item.id);
      const selectedByStatus = item.status === "approved" || item.status === "ready_for_checkout";
      return selectedById && selectedByStatus;
    });

    const lineItems = selected.flatMap((item) => {
      const locator = checkoutLocatorFor(item);
      return locator == null ? [] : [{ productLocator: locator, quantity: item.quantity }];
    });

    const missing = selected.filter((item) => checkoutLocatorFor(item) == null).map((item) => ({
      id: item.id,
      title: item.product.title,
      reason: "Missing checkout locator",
    }));

    return {
      lineItems,
      missing,
      selected: selected.map(compactItem),
    };
  }
}
