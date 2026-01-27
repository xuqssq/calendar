import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 加载 .env 文件
dotenv.config({ path: path.join(__dirname, '.env') });

// ============ 配置 ============
const CONFIG = {
  accessKeyId: process.env.CF_ACCESS_KEY_ID,
  secretAccessKey: process.env.CF_ACCESS_SECRET,
  endpoint: process.env.CF_ENDPOINT,
  bucket: process.env.CF_BUCKET || 'blog',
  publicUrl: process.env.CF_PUBLIC_ACCESS_URL,
  localFile: path.join(__dirname, 'calendar.ics'),
  remoteKey: 'calendar.ics',
};

// ============ 进度条 ============
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function renderProgress(loaded, total) {
  const percent = Math.round((loaded / total) * 100);
  const barLength = 30;
  const filled = Math.round(barLength * (loaded / total));
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  process.stdout.write(`\r⏳ 上传中: [${bar}] ${percent}% (${formatBytes(loaded)}/${formatBytes(total)})`);
}

// ============ 上传函数 ============
async function uploadToR2() {
  // 检查配置
  if (!CONFIG.accessKeyId || !CONFIG.secretAccessKey || !CONFIG.endpoint) {
    console.error('❌ 缺少必要的环境变量，请设置:');
    console.error('   CF_ACCESS_KEY_ID, CF_ACCESS_SECRET, CF_ENDPOINT');
    process.exit(1);
  }

  // 检查文件是否存在
  if (!fs.existsSync(CONFIG.localFile)) {
    console.error(`❌ 文件不存在: ${CONFIG.localFile}`);
    console.error('   请先运行 node generateIcs.js 生成日历文件');
    process.exit(1);
  }

  // 创建 S3 客户端 (R2 兼容 S3 API)
  const client = new S3Client({
    region: 'auto',
    endpoint: CONFIG.endpoint,
    credentials: {
      accessKeyId: CONFIG.accessKeyId,
      secretAccessKey: CONFIG.secretAccessKey,
    },
  });

  // 获取文件信息
  const fileStats = fs.statSync(CONFIG.localFile);
  const fileStream = fs.createReadStream(CONFIG.localFile);

  console.log(`📁 准备上传: ${CONFIG.localFile}`);
  console.log(`📊 文件大小: ${formatBytes(fileStats.size)}`);

  try {
    // 使用 Upload 类支持进度追踪
    const upload = new Upload({
      client,
      params: {
        Bucket: CONFIG.bucket,
        Key: CONFIG.remoteKey,
        Body: fileStream,
        ContentType: 'text/calendar; charset=utf-8',
      },
    });

    // 监听进度事件
    upload.on('httpUploadProgress', (progress) => {
      renderProgress(progress.loaded, fileStats.size);
    });

    await upload.done();

    console.log('\n✅ 上传成功!');
    if (CONFIG.publicUrl) {
      console.log(`🔗 访问地址: ${CONFIG.publicUrl}/${CONFIG.remoteKey}`);
    }
  } catch (error) {
    console.error('\n❌ 上传失败:', error.message);
    process.exit(1);
  }
}

uploadToR2();
