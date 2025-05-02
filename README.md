# Crossmint Checkout MCP Server

Crossmint's Checkout API allows programmatic purchase of physical and virtuals goods and services, 
with programmable money: stablecoins. It enables your AI agent to reliably purchase over 1 billion items, 
without any cost overhead, nor hassle and unreliability of having to use virtual debit cards and browser
use to pay in online forms. 

If your agent can obtain an item SKU/identifier, this API can let it buy it. 

## Capabilities

This MCP server takes an item identifier (from URL to SKUs) and allows you to execute a purchase of it
in a single API call. 

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
- Flights (~May 2)
- Hotels (Mid May)
- Dining
- Tickets

## How are purchases paid

This MCP server requires topping up your server with USDC (stablecoins). A future version 
will allow payments with credit card, with an automatic conversion into stablecoins in 
the backend.

### How to get USDC

USDC is available in crypto exchanges. In addition, this MCP server integrates Coinbase's 
onramp, that can return a link where you can top up manually.

## Setup

In its current version, this server must be ran locally, due to limitations on MCP
security features. 

Also, the delivery address for the order is hardcoded during set up.

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

4. **Obtain API keys**

   - `CROSSMINT_API_KEY`: Get a Crossmint API key for [testing](https://staging.crossmint.com/console/overview) or [production](https://console.crossmint.com):
     - Login to Crossmint Console and navigate to Integrate > API Keys > Create new key 
     - Select scopes: `orders.create`, `orders.read`, `wallets:transactions.create`, `wallets.create`, `wallets.fund`, `wallets.balance:read`
     - Copy API key and paste it in your .env file
   - `COINBASE_PROJECT_ID`: Create a [Coinbase Developer Account](https://docs.cdp.coinbase.com/), copy your Coinbase Project ID, and paste it in your .env file

5. **Fill in delivery information**

   Specify the order's recipient's name, shipping address, and email in the .env file.

6. **Test vs. production**

   Orders attempted with this MCP server are real. Change the `ENV` variable in your .env file to "test" if you want to complete test orders. 

7. **Generate wallet**
   ```bash
   npm run generate-wallet
   ```

8. **Update Claude's configuration**
   ```bash
   npm run update-claude-config
   ```

9. **Build the project**
   ```bash
   npm run build
   ```

10. **Run the server**
   ```bash
   npm run crossmint-checkout
   ```

## Use it with Claude

Ask Claude to:
1. Fund the wallet you'll be using for transactions
2. Describe the product you are looking for and ask for its Amazon.com link, i.e. "I'm looking to buy non-flavored LaCroix sprankling water! Can you look up available listings on Amazon and find something under $5? Share the Amazon link when you are done."
3. Ask Claude to buy it for you, i.e. "Buy this https://www.amazon.com/Sparkling-Naturally-Essenced-Calories-Sweeteners/dp/B00O79SKV6"
4. Check your email for the purchase receipt

## Tools

1. `create-order`
   Creates a new order for a specified product. Amazon products are specified as 'amazon:<amazon_product_id>' or 'amazon:<asin>', while Shopify products as 'shopify:<product-url>:<variant-id>'.

   Example Prompt:
   > "Buy me this https://www.amazon.com/Sparkling-Naturally-Essenced-Calories-Sweeteners/dp/B00O79SKV6"

2. `check-order`
   Checks the status of an existing order.

   Example Prompt:
   > "What's the status of my order? My order id is 8312a4b3-67f0-4518-bf82-8447357295e6"

3. `get-usd-balance`
   Gets the USD balance of the wallet.

   Example Prompt:
   > "What's my wallet's balance?"

4. `fund-usd`
   Generates a Coinbase Pay URL for onramping USDC. Only available in production environment.

   Example Prompt:
   > "I want to fund my wallet with $10"

5. `fund-test-usd`
   Requests USDC from the faucet in the staging environment. Only available in testing environment.

   Example Prompt:
   > "I want to fund my wallet with $10"

## Support

Reach out directly to Crossmint via support@crossmint.io with any questions.