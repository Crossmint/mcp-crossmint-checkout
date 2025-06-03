# Crossmint Checkout MCP Server

Crossmint's Checkout allows programmatic purchase of physical and virtual goods and services, with programmable money. It enables your AI agent to reliably purchase over 1 billion items, without any cost overhead, nor hassle and unreliability of having to use virtual debit cards and browser use to pay in online forms.

If your agent can obtain an item SKU/identifier, this API can let it buy it.

![MCP Demo](assets/mcp-demo-gif.gif)

## Capabilities

This MCP server takes an item identifier (from URL to SKUs) and allows you to execute a purchase of it in a single API call.

These purchases are real:
- The item is delivered with expedited shipping
- A receipt is generated
- Sales tax is properly collected
- Returns and refunds are allowed

### Available Inventory
- **Amazon** (US only)
   - Prime shipping included
- **Shopify** (Global)
   - Buy anything from any Shopify store

Coming soon:
- Flights
- Hotels
- Dining
- Tickets

## How are purchases paid

This MCP server is configured to perform purchases with Crossmint credits. However, simply changing the `WORLDSTORE_PAYMENT_METHOD` variable to "usdc" in your `.env` enables purchases with stablecoins.

### How to get a company treasury wallet

Crossmint will create a wallet for your company and share with you the wallet address.

### How to get credits

Crossmint will securely transfer credits to the company wallet. The company will then be able to transfer credits to agent wallets whenever agents want to top up their wallet or complete a transaction.

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Crossmint/worldstore-mcp.git
   cd worldstore-mcp
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

## Use it with Claude

Ask Claude to:
1. Describe the product you are looking for and ask for its Amazon.com link, i.e. "I'm looking to buy non-flavored LaCroix sparkling water! Can you look up available listings on Amazon and find something under $5? Share the Amazon link when you are done."
2. Ask Claude to buy it for you, i.e. "Buy this https://www.amazon.com/Sparkling-Naturally-Essenced-Calories-Sweeteners/dp/B00O79SKV6"
3. Check your email for the purchase receipt

## Tools

1. `create-order`
   Creates a new order for a specified product. Amazon products are specified as 'amazon:<amazon_product_id>' or 'amazon:<asin>', while Shopify products as 'shopify:<product-url>:<variant-id>'.

   Example Prompt:
   > "Buy me this https://www.amazon.com/Sparkling-Naturally-Essenced-Calories-Sweeteners/dp/B00O79SKV6"

2. `check-order`
   Checks the status of an existing order.

   Example Prompt:
   > "What's the status of my order?"

3. `get-usd-balance`
   Gets the USD balance of the wallet.

   Example Prompt:
   > "What's my wallet's balance?"

## Support

Reach out directly to Crossmint via support@crossmint.io with any questions.

---

# (Rest of the README continues below with technical details, tool descriptions, and contributing instructions)

## Features

- **Amazon Product Search**: Search for products using SearchAPI.io
- **Crossmint Integration**: Create orders and process payments using Crossmint's API
- **MCP Protocol Support**: Implements the Model Control Protocol for AI assistant integration
- **Automated Shipping**: Uses environment variables for shipping information
- **Order & Transaction Polling**: Tools to poll order status and check wallet balances
- **Credit Balance Check**: Always checks your balance before purchase and displays it with search results
- **Error Handling**: Comprehensive error handling and validation

## Prerequisites

- macOS (tested), Linux (likely works), Windows (untested)
- Node.js 18 or higher
- npm or yarn
- Crossmint API key
- SearchAPI.io API key
- Ethereum wallet address for the agent

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/crossmint-checkout.git
cd crossmint-checkout
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
# API Keys
SEARCH_API_KEY=your_searchapi_key
CROSSMINT_API_KEY=your_crossmint_key

# Agent Configuration
AGENT_WALLET_ADDRESS=your_ethereum_wallet_address

# Shipping Information (all will be automatically uppercased)
RECIPIENT_EMAIL=your_email@example.com
RECIPIENT_NAME=Your Name
RECIPIENT_ADDRESS_LINE1=123 Main St
RECIPIENT_ADDRESS_LINE2=Apt 4B (optional)
RECIPIENT_CITY=Your City
RECIPIENT_STATE=Your State
RECIPIENT_POSTAL_CODE=12345
RECIPIENT_COUNTRY=US

# Payment/Token/Chain
CHECKOUT_PAYMENT_METHOD=credit   # or usdc, or a token address
CHECKOUT_CHAIN=ethereum-sepolia  # or your preferred chain

# Environment (optional, defaults to 'test')
ENVIRONMENT=test
```

## Building and Running

1. Build the TypeScript code:
```bash
npm run build
```

2. Run the MCP server:
```bash
npm run crossmint-checkout
```

## Integration with Claude or Other AI Assistants

1. Configure your AI assistant to use the MCP server (see scripts/update-claude-config.js for Claude integration).
2. Use prompts like:
   - "I want to buy wireless headphones."
   - "Search Amazon for a USB-C charger and help me buy it."
   - "Buy this https://www.amazon.com/dp/B07ZPKN6YR"

## Available Tools / Functions

### 1. `search`
- **Description:** Search for products on Amazon and display your current CREDIT (or other token) balance.
- **Parameters:**
  - `query` (string): Search query for Amazon products
- **Returns:**
  - List of products (title, price, ASIN, rating, reviews, URL)
  - Your current balance (formatted)

### 2. `get-credit-balance`
- **Description:** Get the token balance for a wallet (defaults to your agent wallet if not provided)
- **Parameters:**
  - `walletAddress` (string, optional): Wallet address to check balance for
- **Returns:**
  - Formatted balance for the specified token and chain

### 3. `create-order`
- **Description:** Create an order for an Amazon product (checks your balance first)
- **Parameters:**
  - `asin` (string): Amazon ASIN of the product to order
- **Logic:**
  - Checks your balance for the selected token/chain before proceeding
  - If insufficient, returns a message to top up
  - If sufficient, creates the order and returns order details

### 4. `send-transaction`
- **Description:** Send a transaction to complete the order
- **Parameters:**
  - `serializedTransaction` (string): Serialized transaction data from create-order
- **Returns:**
  - Transaction status and ID

### 5. `poll-order-status`
- **Description:** Poll an order until it is completed, failed, or times out (default: 50 attempts, 2s interval, ~100 seconds)
- **Parameters:**
  - `orderId` (string): Order ID to poll for status
- **Returns:**
  - Final status or timeout message

### 6. `check-order-status` (manual status check)
- **Description:** Check the current status of an order immediately (no polling)
- **Parameters:**
  - `orderId` (string): Order ID to check
- **Returns:**
  - Current order phase/status

## Error Handling

- Input validation for all parameters
- Specific error codes for different types of errors
- Detailed error messages
- Stack traces in test environment

## Environment Variables

- `CHECKOUT_PAYMENT_METHOD`: Token to use for payment and balance checks (e.g., `credit`, `usdc`, or a token address)
- `CHECKOUT_CHAIN`: Blockchain network to use (e.g., `ethereum-sepolia`)
- `AGENT_WALLET_ADDRESS`: Wallet address used for all balance checks and payments by default

## Development

### Project Structure
```
.
├── src/
│   └── index.ts           # Main server implementation
├── scripts/
│   ├── generate-agent-wallet.js    # (Optional) Agent wallet generation
│   ├── transfer-credits.js         # (Optional) Credit transfer utility
│   └── update-claude-config.js     # Claude config helper
├── build/                 # Compiled JavaScript files
├── .env                   # Environment variables
├── package.json
└── tsconfig.json
```

### Testing

- Use the available tools via Claude or your AI assistant.
- You can also call the MCP server directly using JSON-RPC over stdio.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT

## Notes
- This project is currently focused on macOS. Linux is likely compatible. Windows is untested.
- Remove or ignore any `.DS_Store` or large asset/demo files before publishing.
- For support, open an issue or submit a pull request.
