/**
 * Country Flags Upload Utility for Cloudflare R2
 *
 * Uploads country flag assets from assets/flags to the private R2 bucket using Wrangler CLI.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadCredentials } from './auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const FLAGS_DIR = path.join(ROOT_DIR, 'assets', 'flags');

async function main() {
  const args = process.argv.slice(2);
  const isLocal = args.includes('--local');
  const creds = loadCredentials();
  const bucketName = creds.r2BucketName || 'country-flags';

  console.log('====================================================');
  console.log(`  Uploading Flag Assets to R2 Bucket: ${bucketName}  `);
  console.log(`  Mode: ${isLocal ? 'Local Wrangler Emulation' : 'Cloudflare Remote R2'}`);
  console.log('====================================================\n');

  if (!fs.existsSync(FLAGS_DIR)) {
    console.error(`Flags directory not found at: ${FLAGS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(FLAGS_DIR).filter((f: string) => f.endsWith('.svg') || f.endsWith('.png'));

  if (files.length === 0) {
    console.log('No flag files found in assets/flags.');
    return;
  }

  console.log(`Found ${files.length} flag files to sync...\n`);

  for (const file of files) {
    const filePath = path.join(FLAGS_DIR, file);
    const key = file.toLowerCase();
    const contentType = file.endsWith('.svg') ? 'image/svg+xml' : 'image/png';

    const localArg = isLocal ? ' --local' : '';
    const command = `npx wrangler r2 object put "${bucketName}/${key}" --file "${filePath}" --content-type "${contentType}"${localArg}`;

    const envVars = {
      ...process.env,
      ...(creds.apiToken ? { CLOUDFLARE_API_TOKEN: creds.apiToken } : {}),
      ...(creds.accountId ? { CLOUDFLARE_ACCOUNT_ID: creds.accountId } : {})
    };

    console.log(`Uploading: ${file} -> r2://${bucketName}/${key}...`);
    try {
      execSync(command, { cwd: ROOT_DIR, stdio: 'pipe', env: envVars });
      console.log(`  ✅ Successfully uploaded ${key}`);
    } catch (err: any) {
      console.error(`  ❌ Failed to upload ${key}:`, err.stderr?.toString() || err.message);
    }
  }

  console.log('\n🎉 Finished syncing flags to R2 bucket.');
}

main().catch((err) => {
  console.error('Fatal error in flag upload utility:', err);
  process.exit(1);
});
