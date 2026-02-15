import 'dotenv/config';
import { resolve } from 'path';

// Load .env.local
require('dotenv').config({ path: resolve(__dirname, '..', '.env.local') });

// Register tsconfig paths
const tsconfig = require('../tsconfig.json');
const { register } = require('tsconfig-paths');
register({ baseUrl: resolve(__dirname, '..'), paths: tsconfig.compilerOptions.paths });

async function main() {
  const { processNewEmails } = require('../src/lib/services/email-processor');
  const { createGmailServiceForOrg } = require('../src/lib/services/gmail.service');

  const orgId = '784803bf-d071-4bb6-8990-b988352325b6';

  console.log('Creating Gmail service for org...');
  const gmailService = await createGmailServiceForOrg(orgId);
  if (!gmailService) {
    console.log('ERROR: No Gmail credentials for this org. Falling back to env vars...');
  }
  console.log('Fetching emails (no limit, 90-day lookback)...');
  const stats = await processNewEmails(orgId, Date.now(), 0, gmailService ?? undefined);
  console.log('\nDone!');
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
