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
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && value) {
      // Remove surrounding quotes if they exist
      acc[key.trim()] = value.replace(/^["']|["']$/g, '');
    }
    return acc;
  }, {});

// Read the existing config
let config;
try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configContent);
} catch (error) {
  console.error('Error reading config file:', error);
  process.exit(1);
}

// Completely replace the env object in the config
if (config.mcpServers && config.mcpServers['crossmint-checkout']) {
  config.mcpServers['crossmint-checkout'].env = envVars;
}

// Write the updated config back to the file
try {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
  console.log('Successfully updated Claude config with new environment variables');
} catch (error) {
  console.error('Error writing config file:', error);
  process.exit(1);
} 