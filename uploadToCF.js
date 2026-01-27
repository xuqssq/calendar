import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { uploadToR2 } from './lib/uploadToR2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '.env') });

async function main() {
  try {
    await uploadToR2({
      accessKeyId: process.env.CF_ACCESS_KEY_ID,
      secretAccessKey: process.env.CF_ACCESS_SECRET,
      endpoint: process.env.CF_ENDPOINT,
      bucket: process.env.CF_BUCKET,
      publicUrl: process.env.CF_PUBLIC_ACCESS_URL,
      localFile: path.join(__dirname, 'calendar.ics'),
      remoteKey: 'calendar.ics',
      contentType: 'text/calendar; charset=utf-8',
    });
  } catch (error) {
    console.error('❌', error.message);
    process.exit(1);
  }
}

main();
