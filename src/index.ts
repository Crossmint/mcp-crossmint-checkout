import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getOnrampBuyUrl } from '@coinbase/onchainkit/fund';
import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.ENVIRONMENT === 'prod';
const CROSSMINT_API_BASE = isProduction 
  ? "https://www.crossmint.com/api"
  : "https://staging.crossmint.com/api";
const CHAIN = "solana";
const TOKEN = "usdc";
const USER_AGENT = "crossmint-checkout/1.0";

// Create server instance
const server = new McpServer({
  name: "crossmint-checkout",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

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
  if (!process.env.CROSSMINT_API_KEY || !process.env.CROSSMINT_WALLET_ADDRESS) {
    return null;
  }

  try {
    const response = await fetch(
      `${CROSSMINT_API_BASE}/2022-06-09/wallets/${process.env.CROSSMINT_WALLET_ADDRESS}/transactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.CROSSMINT_API_KEY,
        },
        body: JSON.stringify({
          params: {
            transaction: serializedTx
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.params.transaction;
    
  } catch (error) {
    console.error("Error submitting transaction via Crossmint:", error);
    return null;
  }
}

// Register crossmint checkout tool to create orders
server.tool(
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
  }) => {

    try {
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
          payerAddress: process.env.CROSSMINT_WALLET_ADDRESS,
          receiptEmail: process.env.RECIPIENT_EMAIL,
        },
        lineItems,
      };

      const response = await makeCrossmintRequest("/orders", "POST", orderData);

      const serializedTx = response.order.payment.preparation.serializedTransaction;

      const orderId = response.order.orderId;

      const txHash = await createTransaction(serializedTx);

      return {
        content: [
          { 
            type: "text",
            text: `Your order was successfully submitted! Order ID: ${orderId}. Transaction hash: ${txHash}`,
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


server.tool(
  "check-order",
  "Check the status of an existing order",
  {
    orderId: z.string().describe("The order ID to check"),
  },
  async ({ orderId }) => {
    try {
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

// Funding tool - only available in production
if (isProduction) {
  server.tool(
    "fund-usd",
    "Onramp USDC",
    {
      amountUsd: z.number().describe("Amount in USD to onramp"),
    },
    async ({ amountUsd }) => {
      try {
        if (!process.env.COINBASE_PROJECT_ID) {
          throw new Error("COINBASE_PROJECT_ID is not set");
        }

        const address = process.env.CROSSMINT_WALLET_ADDRESS;

        if (!address) {
          throw new Error("No address found");
        }

        const onrampUrl = getOnrampBuyUrl({
          projectId: process.env.COINBASE_PROJECT_ID,
          addresses: { [address]: ['solana'] },
          assets: [TOKEN],
          presetFiatAmount: amountUsd,
          fiatCurrency: 'USD',
          redirectUrl: '',
        });

        return {
          content: [
            {
              type: "text",
              text: `Here's your Coinbase Pay URL for onramping $${amountUsd} USDC: ${onrampUrl}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to generate onramp URL: ${JSON.stringify(error, null, 2)}`,
            },
          ],
        };
      }
    }
  );
} else {
  // Test funding tool - only for testing
  server.tool(
    "fund-test-usd",
    "Get USD in a testing environment",
    {
      amount: z.number().describe("Amount of USD to request"),
    },
    async ({ amount }) => {
      try {
        const address = process.env.CROSSMINT_WALLET_ADDRESS;

        const response = await fetch(
          `${CROSSMINT_API_BASE}/v1-alpha2/wallets/${address}/balances`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-KEY': process.env.CROSSMINT_API_KEY || '',
            },
            body: JSON.stringify({
              amount,
              token: TOKEN,
            })
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
              text: `Successfully requested ${amount} USDC from faucet: ${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to request USDC from faucet: ${JSON.stringify(error, null, 2)}`,
            },
          ],
        };
      }
    }
  );
}

// Get balance tool
server.tool(
  "get-usd-balance",
  "Get the USD balance of the wallet",
  {},
  async () => {
    try {
      const address = process.env.CROSSMINT_WALLET_ADDRESS;

      const response = await fetch(
        `${CROSSMINT_API_BASE}/v1-alpha2/wallets/${address}/balances?tokens=${TOKEN}`,
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
  if (!process.env.CROSSMINT_API_KEY) {
    process.exit(1);
  }

  if (!process.env.CROSSMINT_WALLET_ADDRESS) {
    process.exit(1);
  }
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});