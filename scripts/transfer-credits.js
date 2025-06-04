import { encodeFunctionData } from 'viem'
import dotenv from 'dotenv'

dotenv.config()

const isProduction = process.env.ENVIRONMENT === 'prod'
const CHAIN = isProduction ? 'base' : 'base-sepolia'
const CREDIT_TOKEN_ADDRESS = '0xe1809a1Ce9495b95EaC7c0Bf90BeeccEbf4063F9' //testnet
const CROSSMINT_API_BASE = isProduction 
  ? "https://www.crossmint.com/api/2022-06-09"
  : "https://staging.crossmint.com/api/2022-06-09";

async function getWalletAddress(locator) {
  const fullLocator = `userId:${locator}:evm-smart-wallet`
  const encodedLocator = encodeURIComponent(fullLocator)
  const response = await fetch(`${CROSSMINT_API_BASE}/wallets/${encodedLocator}`, {
    method: 'GET',
    headers: {
      'X-API-KEY': process.env.CROSSMINT_API_KEY
    }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to get wallet address: ${response.statusText}`)
  }
  
  const data = await response.json()
  return data.address
}

function generateCallData(recipient, amount) {
  return encodeFunctionData({
    abi: [
      {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'recipient', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: 'success', type: 'bool' }]
      }
    ],
    functionName: 'transfer',
    args: [recipient, amount],
  })
}

async function createTransaction(walletAddress, callData) {

  const response = await fetch(`${CROSSMINT_API_BASE}/wallets/${walletAddress}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': process.env.CROSSMINT_API_KEY
    },
    body: JSON.stringify({
      params: {
        calls: [
          {
            to: CREDIT_TOKEN_ADDRESS,
            value: '0',
            data: callData
          }
        ],
        chain: CHAIN
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to create transaction: ${response.statusText}`)
  }

  return response.json()
}

async function main() {
  if (process.argv.length !== 4) {
    console.error('Usage: node credit-transfer.js <amount> <recipient_locator>')
    process.exit(1)
  }

  const amount = 10**6 * Number(process.argv[2])
  const recipientLocator = process.argv[3]

  try {
    const walletAddress = await getWalletAddress(recipientLocator)
    const callData = generateCallData(walletAddress, amount)
    const transaction = await createTransaction(process.env.COMPANY_WALLET_ADDRESS, callData)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
