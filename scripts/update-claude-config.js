import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the config file
const configPath = path.join(process.env.HOME, 'Library/Application Support/Claude/claude_desktop_config.json');

// Read the .env file
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');

// Parse .env content into key-value pairs and remove quotes
const envVars = envContent
  .split('\n')
  .filter(line => line.trim() && !line.startsWith('#'))
  .reduce((acc, line) => {
    // Split on first '=' and remove any comments
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && value) {
      // Remove surrounding quotes if they exist and any inline comments
      const cleanValue = value.replace(/^["']|["']$/g, '').split('#')[0].trim();
      acc[key.trim()] = cleanValue;
    }
    return acc;
  }, {});

// Calculate the path to build/index.js relative to this script
const buildIndexPath = path.join(__dirname, '../build/index.js');

// Read the existing config or create a new one
let config;
try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configContent);
} catch (error) {
  // If file doesn't exist or is invalid JSON, create a new config
  config = {};
}

// Ensure mcpServers object exists
if (!config.mcpServers) {
  config.mcpServers = {};
}

// Update or create the crossmint-checkout server configuration
config.mcpServers['crossmint-checkout'] = {
  command: 'node',
  args: [buildIndexPath],
  env: envVars
};

// Write the updated config back to the file
try {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
  console.log('Successfully updated Claude config with new environment variables and server configuration');
} catch (error) {
  console.error('Error writing config file:', error);
  process.exit(1);
} 