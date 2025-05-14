import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const isProduction = process.env.ENVIRONMENT === 'prod';
const CROSSMINT_API_BASE = isProduction 
  ? "https://www.crossmint.com/api/2022-06-09"
  : "https://staging.crossmint.com/api/2022-06-09";


async function createCrossmintWallet(userid) {
  
  const walletData = {
    config: {
      adminSigner: {
        type: "evm-fireblocks-custodial"
      }
    },
    linkedUser: "userId:" + userid,
    type: "evm-smart-wallet"
  };

  const response = await fetch(`${CROSSMINT_API_BASE}/wallets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': process.env.CROSSMINT_API_KEY || '',
    },
    body: JSON.stringify(walletData)
  });

  if (!response.ok) {
    throw new Error(`Failed to create wallet: ${response.statusText}`);
  }

  return await response.json();
}

async function main() {
  try {
    if (!process.env.CROSSMINT_API_KEY) {
      throw new Error("CROSSMINT_API_KEY environment variable is not set");
    }
    if (!process.env.USER_ID) {
      throw new Error("USER_ID environment variable is not set");
    }

    // Create Crossmint wallet
    console.log('\nCreating wallet...');
    const walletResponse = await createCrossmintWallet(process.env.USER_ID);

    // Read existing .env file
    let envContent = '';
    try {
      envContent = await fs.promises.readFile('.env', 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Remove existing wallet variables
    envContent = envContent
      .split('\n')
      .filter(line => !line.startsWith('AGENT_WALLET_ADDRESS='))
      .join('\n')
      .trim();

    // Add new wallet variables
    const newEnvContent = `${envContent}\n\nAGENT_WALLET_ADDRESS=${walletResponse.address}\n`;
    await fs.promises.writeFile('.env', newEnvContent);
    console.log(`\nAgent wallet address, ${walletResponse.address}, for user ${process.env.USER_ID} has been updated in .env file`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main(); 