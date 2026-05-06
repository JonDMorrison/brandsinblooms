/**
 * Deploy BloomSuite Embed Assets to Supabase Storage
 * 
 * This script uploads embed.js, embed.css, and versioned files to Supabase Storage
 * for hosting on a domain that won't be blocked by third-party website builders.
 * 
 * Usage:
 *   npx ts-node scripts/deploy-embed-assets.ts
 *   
 * Or with bun:
 *   bun run scripts/deploy-embed-assets.ts
 * 
 * Prerequisites:
 *   - SUPABASE_SERVICE_ROLE_KEY environment variable must be set
 *   - The 'assets' bucket must exist and be public
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://udldmkqwnxhdeztyqcau.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('   Set it in your environment or .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const BUCKET_NAME = 'assets';
const STORAGE_PATH_PREFIX = 'forms';

// Files to upload with their storage paths
const EMBED_FILES = [
  { local: 'public/forms/embed.js', storage: 'embed.js' },
  { local: 'public/forms/embed.v1.js', storage: 'embed.v1.js' },
  { local: 'public/forms/embed.v1.4.0.js', storage: 'embed.v1.4.0.js' },
  { local: 'public/forms/embed.v1.5.0.js', storage: 'embed.v1.5.0.js' },
  { local: 'public/forms/embed.css', storage: 'embed.css' },
];

async function uploadFile(localPath: string, storagePath: string): Promise<boolean> {
  const fullStoragePath = `${STORAGE_PATH_PREFIX}/${storagePath}`;
  
  try {
    // Read file content
    const absolutePath = path.resolve(process.cwd(), localPath);
    
    if (!fs.existsSync(absolutePath)) {
      console.warn(`⚠️  File not found: ${localPath} (skipping)`);
      return false;
    }
    
    const fileContent = fs.readFileSync(absolutePath);
    const contentType = localPath.endsWith('.css') ? 'text/css' : 'application/javascript';
    
    // Upload to Supabase Storage (upsert)
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fullStoragePath, fileContent, {
        contentType,
        upsert: true,
        cacheControl: storagePath.match(/\.v\d+\.\d+\.\d+\./)
          ? '300' // 5 min — allows quick rollout of in-place fixes
          : '300', // 5 min for aliases
      });
    
    if (error) {
      console.error(`❌ Failed to upload ${localPath}: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Uploaded: ${localPath} → ${fullStoragePath}`);
    return true;
  } catch (err) {
    console.error(`❌ Error uploading ${localPath}:`, err);
    return false;
  }
}

async function verifyPublicAccess(storagePath: string): Promise<boolean> {
  const fullStoragePath = `${STORAGE_PATH_PREFIX}/${storagePath}`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${fullStoragePath}`;
  
  try {
    const response = await fetch(publicUrl, { method: 'HEAD' });
    
    if (response.ok) {
      console.log(`✅ Verified public access: ${publicUrl}`);
      return true;
    } else {
      console.error(`❌ Public access failed (${response.status}): ${publicUrl}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Network error verifying ${publicUrl}:`, err);
    return false;
  }
}

async function main() {
  console.log('🚀 Deploying BloomSuite embed assets to Supabase Storage\n');
  console.log(`   Bucket: ${BUCKET_NAME}`);
  console.log(`   Path prefix: ${STORAGE_PATH_PREFIX}/`);
  console.log(`   Supabase URL: ${SUPABASE_URL}\n`);
  
  // Upload all files
  let uploadCount = 0;
  for (const file of EMBED_FILES) {
    const success = await uploadFile(file.local, file.storage);
    if (success) uploadCount++;
  }
  
  console.log(`\n📦 Uploaded ${uploadCount}/${EMBED_FILES.length} files\n`);
  
  // Verify public access
  console.log('🔍 Verifying public access...\n');
  
  let verifyCount = 0;
  for (const file of EMBED_FILES) {
    if (fs.existsSync(path.resolve(process.cwd(), file.local))) {
      const success = await verifyPublicAccess(file.storage);
      if (success) verifyCount++;
    }
  }
  
  console.log(`\n✅ Verified ${verifyCount} files are publicly accessible\n`);
  
  // Print final URLs
  console.log('📋 Production URLs:\n');
  console.log('   Major Version (Recommended):');
  console.log(`   ${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${STORAGE_PATH_PREFIX}/embed.v1.js\n`);
  console.log('   Pinned Version:');
  console.log(`   ${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${STORAGE_PATH_PREFIX}/embed.v1.5.0.js\n`);
  console.log('   CSS:');
  console.log(`   ${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${STORAGE_PATH_PREFIX}/embed.css\n`);
  
  console.log('📝 Customer Embed Snippet:\n');
  console.log('   <div data-bloomsuite-form="YOUR_EMBED_KEY"></div>');
  console.log(`   <script src="${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${STORAGE_PATH_PREFIX}/embed.v1.js" defer></script>\n`);
}

main().catch(console.error);
