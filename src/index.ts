#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import {
  BasketStore,
  getBasketViewerUrl,
  resolveBasketStorePath,
  resolveBasketViewerPort,
  summarizeBasket,
} from "./basket/store.js";
import {
  BASKET_MODEL_FIELD_GUIDE,
  BasketContextInputSchema,
  CandidateStatusSchema,
  CartItemInputSchema,
} from "./basket/schema.js";

dotenv.config();

const isProduction = process.env.ENVIRONMENT === 'prod';
const CROSSMINT_API_BASE = isProduction 
  ? "https://www.crossmint.com/api"
  : "https://staging.crossmint.com/api";
const CHAIN = isProduction ? 'ethereum' : 'ethereum-sepolia';
const TOKEN = 'credit';
const USER_AGENT = "crossmint-checkout/1.0";
const basketStore = new BasketStore();
const basketContextToolShape = BasketContextInputSchema.shape as Record<string, z.ZodTypeAny>;
const cartItemInputToolSchema = (CartItemInputSchema as z.ZodTypeAny)
  .describe("Universal cart product candidate with product, price, merchant, evidence, and checkout fields.");
const candidateStatusToolSchema = CandidateStatusSchema as z.ZodTypeAny;

// Create server instance
const server = new McpServer({
  name: "crossmint-checkout",
  version: "1.0.0",
});
const registerTool = server.tool.bind(server) as (...args: any[]) => void;

function textResponse(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function missingCheckoutConfig(): string[] {
  const missing = [];
  if (!process.env.CROSSMINT_API_KEY) {
    missing.push("CROSSMINT_API_KEY");
  }
  if (!process.env.AGENT_WALLET_ADDRESS) {
    missing.push("AGENT_WALLET_ADDRESS");
  }
  return missing;
}

// Helper function for making Crossmint API requests
async function makeCrossmintRequest(
  endpoint: string,
  method: string = "GET",
  body?: any
): Promise<any | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json",
    "X-API-KEY": process.env.CROSSMINT_API_KEY || "",
  };

  try {
    const response = await fetch(`${CROSSMINT_API_BASE}/2022-06-09${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      try {
        const json = await response.json();
        throw new Error(`HTTP error! status: ${json.message}, message: ${json.message}`);
      } catch (error) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Helper function to sign and submit transaction via Crossmint API
async function createTransaction(serializedTx: string): Promise<string | null> {
  if (!process.env.CROSSMINT_API_KEY || !process.env.AGENT_WALLET_ADDRESS) {
    return null;
  }

  try {

    const response = await fetch(
      `${CROSSMINT_API_BASE}/2022-06-09/wallets/${process.env.AGENT_WALLET_ADDRESS}/transactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.CROSSMINT_API_KEY,
        },
        body: JSON.stringify({
          params: {
            calls:[{
              transaction: serializedTx
            }],
            chain: CHAIN
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.status;
    
  } catch (error) {
    console.error("Error submitting transaction via Crossmint:", error);
    return null;
  }
}

registerTool(
  "basket-set-context",
  "Set shopping or research context for the neutral pre-checkout basket",
  basketContextToolShape,
  async (input: any) => {
    const basket = await basketStore.setContext(input);
    return textResponse({
      basket: summarizeBasket(basket),
      storePath: basketStore.path(),
      viewerUrl: getBasketViewerUrl(),
    });
  }
);

registerTool(
  "basket-upsert-product",
  "Add or update a product candidate in the neutral pre-checkout basket",
  {
    item: cartItemInputToolSchema,
  },
  async ({ item }: any) => {
    const result = await basketStore.upsertItem(item);
    return textResponse({
      created: result.created,
      item: result.item,
      basket: summarizeBasket(result.basket),
      viewerUrl: getBasketViewerUrl(),
    });
  }
);

registerTool(
  "basket-list-products",
  "List product candidates currently stored in the pre-checkout basket",
  {
    includeRaw: z.boolean().optional().describe("Return full raw basket data instead of compact UI summary."),
  },
  async ({ includeRaw }: any) => {
    const basket = await basketStore.load();
    return textResponse({
      basket: includeRaw ? basket : summarizeBasket(basket),
      storePath: basketStore.path(),
      viewerUrl: getBasketViewerUrl(),
      modelFields: includeRaw ? BASKET_MODEL_FIELD_GUIDE : undefined,
    });
  }
);

registerTool(
  "basket-update-status",
  "Update a product candidate status without changing the product snapshot",
  {
    id: z.string().describe("Basket item id."),
    status: candidateStatusToolSchema.describe("New candidate status."),
  },
  async ({ id, status }: any) => {
    const item = await basketStore.updateStatus(id, status);
    if (item == null) {
      return textResponse({ error: "Item not found", id });
    }
    return textResponse({
      item,
      basket: summarizeBasket(await basketStore.load()),
      viewerUrl: getBasketViewerUrl(),
    });
  }
);

registerTool(
  "basket-remove-product",
  "Remove a product candidate from the pre-checkout basket",
  {
    id: z.string().describe("Basket item id."),
  },
  async ({ id }: any) => {
    const removed = await basketStore.removeItem(id);
    return textResponse({
      removed,
      basket: summarizeBasket(await basketStore.load()),
      viewerUrl: getBasketViewerUrl(),
    });
  }
);

registerTool(
  "basket-clear",
  "Clear all product candidates from the pre-checkout basket",
  {
    confirm: z.boolean().describe("Must be true to clear the basket."),
  },
  async ({ confirm }: any) => {
    if (confirm !== true) {
      return textResponse({ error: "confirm must be true" });
    }
    return textResponse({
      basket: summarizeBasket(await basketStore.clear()),
      viewerUrl: getBasketViewerUrl(),
    });
  }
);

registerTool(
  "basket-get-viewer",
  "Return the local basket viewer URL, store path, and startup command",
  {},
  async () => {
    const port = resolveBasketViewerPort();
    return textResponse({
      viewerUrl: getBasketViewerUrl(port),
      storePath: resolveBasketStorePath(),
      command: "npm run basket-viewer",
      api: {
        basket: `${getBasketViewerUrl(port)}/api/basket`,
        rawBasket: `${getBasketViewerUrl(port)}/api/basket/raw`,
        addItem: `${getBasketViewerUrl(port)}/api/items`,
      },
    });
  }
);

registerTool(
  "basket-export-crossmint-line-items",
  "Export approved basket candidates as Crossmint create-order lineItems when locators are available",
  {
    itemIds: z.array(z.string()).optional().describe("Optional list of basket item ids. Defaults to approved or ready_for_checkout items."),
  },
  async ({ itemIds }: any) => {
    return textResponse(await basketStore.exportCrossmintLineItems(itemIds));
  }
);

// Register crossmint checkout tool to create orders
registerTool(
  "create-order",
  "Create a new order for a product",
  {
    lineItems: z.array(
      z.object({
        productLocator: z.string()
          .describe("The product locator. Ex: 'amazon:<amazon_product_url>', 'amazon:<asin>', 'shopify:<product-url>:<variant-id>'"),
      })
    ).length(1).describe("Item to purchase")
  },
  async ({
    lineItems
  }: any) => {

    try {
      const missing = missingCheckoutConfig();
      if (missing.length > 0) {
        return textResponse({
          error: "Crossmint checkout is not configured. Basket tools still work.",
          missingEnv: missing,
        });
      }

      const envRecipient = {
        email: process.env.RECIPIENT_EMAIL,
        physicalAddress: {
          name: process.env.RECIPIENT_NAME,
          line1: process.env.RECIPIENT_ADDRESS_LINE1,
          line2: process.env.RECIPIENT_ADDRESS_LINE2 || '',
          city: process.env.RECIPIENT_CITY,
          state: process.env.RECIPIENT_STATE,
          postalCode: process.env.RECIPIENT_POSTAL_CODE,
          country: process.env.RECIPIENT_COUNTRY,
        }
      };
  
      const orderData = {
        recipient: envRecipient,
        payment: {
          method: CHAIN,
          currency: TOKEN,
          payerAddress: process.env.AGENT_WALLET_ADDRESS,
          receiptEmail: process.env.RECIPIENT_EMAIL,
        },
        lineItems,
      };

      const response = await makeCrossmintRequest("/orders", "POST", orderData);

      const serializedTx = response.order.payment.preparation.serializedTransaction;

      const orderId = response.order.orderId;

      const status = await createTransaction(serializedTx);

      return {
        content: [
          { 
            type: "text",
            text: `Your request was successfully submitted! Order ID: ${orderId}. Order status: ${status}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to process order: ${JSON.stringify(error, null, 2)}`,
          },
        ],
      };
    }
  }
);


registerTool(
  "check-order",
  "Check the status of an existing order",
  {
    orderId: z.string().describe("The order ID to check"),
  },
  async ({ orderId }: any) => {
    try {
      if (!process.env.CROSSMINT_API_KEY) {
        return textResponse({
          error: "Crossmint checkout is not configured.",
          missingEnv: ["CROSSMINT_API_KEY"],
        });
      }

      const response = await makeCrossmintRequest(`/orders/${orderId}`);

      return {
        content: [
          { 
            type: "text",
            text: `Status: \n - Order is ${JSON.stringify(response.phase, null, 2)} \n - Payment is ${JSON.stringify(response.lineItems[0].delivery.status, null, 2)}`,
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve order status",
          },
        ],
      };
    }
  }
);

// Get balance tool
registerTool(
  "get-usd-balance",
  "Get the USD balance of the wallet",
  {},
  async () => {
    try {
      const missing = missingCheckoutConfig();
      if (missing.length > 0) {
        return textResponse({
          error: "Crossmint checkout is not configured.",
          missingEnv: missing,
        });
      }

      const address = process.env.AGENT_WALLET_ADDRESS;

      const response = await fetch(
        `${CROSSMINT_API_BASE}/v1-alpha2/wallets/${address}/balances?tokens=${TOKEN}&chains=${CHAIN}`,
        {
          headers: {
            "X-API-KEY": process.env.CROSSMINT_API_KEY || "",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        content: [
          {
            type: "text",
            text: `USD Balance: ${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to get USD balance: ${JSON.stringify(error, null, 2)}`,
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
