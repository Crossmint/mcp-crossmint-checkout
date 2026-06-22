# Crossmint Checkout MCP Server

Crossmint's Checkout allows programmatic purchase of physical and virtual goods and services, 
with programmable money. It enables your AI agent to reliably purchase over 1 billion items, 
without any cost overhead, nor hassle and unreliability of having to use virtual debit cards and browser
use to pay in online forms. 

If your agent can obtain an item SKU/identifier, this API can let it buy it. 

![MCP Demo](assets/mcp-demo-gif.gif)

## Capabilities

This MCP server takes an item identifier (from URL to SKUs) and allows you to execute a purchase of it
in a single API call. 

It also includes an agent-facing pre-checkout basket:
- Neutral product model for any e-commerce store
- Local JSON persistence for purchase candidates
- MCP tools to add, review, approve, reject, and export candidates
- A local web viewer for humans and agents to inspect the basket before any real checkout

These purchases are real: 
- The item is delivered with expedited shipping
- A receipt is generated
- Sales tax is properly collected
- Returns and refunds are allowed

### Available Inventory
- **Amazon** (US only)
   - Prime shipping included
- **Shopify** (Global) 
   - Buy anything from any shopify store

Coming soon:
- Flights
- Hotels
- Dining
- Tickets

## How are purchases paid

This MCP server is configured to perform purchases with Crossmint credits. Please [contact us](support@crossmint.io) if you are interested to learn more. To use USDC instead of credits:
1. Change  TOKEN variable to "usdc" in src/index.ts
2. Change the CREDIT_TOKEN_ADDRESS to the USDC address on ethereum `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`

### How to get a company treasury wallet

Crossmint will create a wallet for your company and share with you the wallet address. 

### How to get credits

Crossmint will securely transfer credits to the company wallet. The company will then be able to transfer credits to agent wallets whenever agents want to top up their wallet or complete a transaction.

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Crossmint/mcp-crossmint-checkout.git
   cd mcp-crossmint-checkout
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create .env file** 

   ```bash
   cp .env.template .env
   ```

4. **Obtain Crossmint API key**

   - Login to [Crossmint Console](https://www.crossmint.com/signin?callbackUrl=/console) and navigate to Integrate > API Keys > Create new server key 
   - Select scopes: `orders.create`, `orders.read`, `wallets:transactions.create`, `wallets.create`, `wallets.read`, `wallets.balance:read`. 
   - Copy API key and paste it in your .env file

5. **Fill in user & delivery information**

   Specify the user's id as well as their name, shipping address, and email in the .env file. Also make sure to fill in your company's wallet address.

6. **Test vs. production**

   Keep the `ENV` variable in your .env file to "test" so you can test orders. Change it to "prod" to complete real orders. 

7. **Generate an agent wallet**
   ```bash
   npm run generate-agent-wallet
   ```

8. **Transfer credits to agent wallet**
   
   To transfer 5 credits from the company's wallet to a user identified via userId "johnjoe", run the following
   ```bash
   npm run transfer-credits -- 5 johndoe
   ```
   If instead you uniquely identify users via email, you can adjust the user locator in `generate-wallet.js` and `credit-transfer.js` 

9. **Update Claude's configuration**
   ```bash
   npm run update-claude-config
   ```

10. **Build the project**

    ```bash
    npm run build
    ```

11. **Run the server**

    ```bash
    npm run crossmint-checkout
    ```

## Agent Basket Viewer

The basket works without Crossmint credentials. It is designed for research and pre-purchase workflows where an agent needs to collect product candidates before the user approves checkout.

```bash
npm run build
npm run basket-viewer
```

Default URL:

```text
http://localhost:4377
```

Optional environment variables:

```bash
CROSSMINT_BASKET_PORT=4377
CROSSMINT_BASKET_STORE_PATH=.crossmint-agent-basket/basket.json
CROSSMINT_BASKET_PUBLIC_HOST=https://your-host.example.com
```

HTTP API:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/basket` | Compact basket summary for the viewer |
| `GET` | `/api/basket/raw` | Full neutral basket JSON |
| `POST` | `/api/context` | Set title, intent, buyer, locale, constraints |
| `POST` | `/api/items` | Add or update a product candidate |
| `POST` | `/api/items/:id/status` | Update status |
| `DELETE` | `/api/items/:id` | Remove candidate |
| `POST` | `/api/clear` | Clear basket with `{ "confirm": true }` |

Minimal product candidate:

```json
{
  "product": {
    "title": "Example product",
    "merchant": {
      "name": "Example Store",
      "domain": "example.com",
      "platform": "shopify"
    },
    "identifiers": {
      "sourceUrl": "https://example.com/products/example",
      "productLocator": "shopify:https://example.com/products/example:123456"
    },
    "price": {
      "current": {
        "amount": 29.99,
        "currency": "USD",
        "confidence": "exact"
      }
    },
    "evidence": {
      "reason": "Matches the user request",
      "confidence": "medium"
    }
  },
  "quantity": 1,
  "status": "candidate"
}
```

Core neutral model areas:

- Product identity: URLs, SKU, ASIN, GTIN/UPC/EAN/ISBN, variant IDs, Crossmint locator
- Merchant: name, domain, country, platform, seller
- Price: current/list/unit/subtotal/shipping/tax/total/discount/coupons
- Availability: stock, limits, restock message
- Variants and attributes: size, color, material, specs
- Fulfillment and policy: shipping/pickup/digital, returns, warranty, restrictions
- Agent evidence: query, sources, rationale, confidence
- Checkout: provider, locator, support, readiness, order ID

## Use it with Claude

Ask Claude to:
1. Describe the product you are looking for and ask for its Amazon.com link, i.e. "I'm looking to buy non-flavored LaCroix sprankling water! Can you look up available listings on Amazon and find something under $5? Share the Amazon link when you are done."
2. Ask Claude to buy it for you, i.e. "Buy this https://www.amazon.com/Sparkling-Naturally-Essenced-Calories-Sweeteners/dp/B00O79SKV6"
3. Check your email for the purchase receipt

## Tools

### Basket tools

1. `basket-set-context`
   Sets the basket title, user intent, locale, currency, destination, target stores, and constraints.

2. `basket-upsert-product`
   Adds or updates a universal product candidate.

3. `basket-list-products`
   Lists current candidates and returns the viewer URL.

4. `basket-update-status`
   Moves a candidate through `candidate`, `shortlisted`, `needs_review`, `approved`, `ready_for_checkout`, `ordered`, or `rejected`.

5. `basket-export-crossmint-line-items`
   Exports approved/ready candidates with Crossmint-compatible locators.

6. `basket-get-viewer`
   Returns viewer URL, store path, and HTTP API endpoints.

### Checkout tools

1. `create-order`
   Creates a new order for a specified product. Amazon products are specified as 'amazon:<amazon_product_id>' or 'amazon:<asin>', while Shopify products as 'shopify:<product-url>:<variant-id>'.

   This performs a real checkout when Crossmint credentials and wallet env vars are configured.

   Example Prompt:
   > "Buy me this https://www.amazon.com/Sparkling-Naturally-Essenced-Calories-Sweeteners/dp/B00O79SKV6"

2. `check-order`
   Checks the status of an existing order. 

   Example Prompt:
   > "What's the status of my order? 

3. `get-usd-balance`
   Gets the USD balance of the wallet.

   Example Prompt:
   > "What's my wallet's balance?"

## Support

Reach out directly to Crossmint via support@crossmint.io with any questions.
