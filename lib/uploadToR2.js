import fs from 'fs';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

// ============ 工具函数 ============
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

/**
 * 上传文件到 Cloudflare R2
 * @param {Object} config - 配置对象
 * @param {string} config.accessKeyId - R2 Access Key ID
 * @param {string} config.secretAccessKey - R2 Secret Access Key
 * @param {string} config.endpoint - R2 Endpoint URL
 * @param {string} config.bucket - 存储桶名称
 * @param {string} config.localFile - 本地文件路径
 * @param {string} config.remoteKey - 远程文件名
 * @param {string} [config.contentType] - 文件 MIME 类型
 * @param {string} [config.publicUrl] - 公开访问 URL 前缀
 * @param {Function} [config.onProgress] - 进度回调 (loaded, total) => void
 * @param {boolean} [config.silent] - 静默模式，不输出日志
 * @returns {Promise<{url?: string}>} 上传结果
 */
export async function uploadToR2(config) {
  const {
    accessKeyId,
    secretAccessKey,
    endpoint,
    bucket,
    localFile,
    remoteKey,
    contentType = 'application/octet-stream',
    publicUrl,
    onProgress,
    silent = false,
  } = config;

  const log = silent ? () => {} : console.log;

  // 检查必要配置
  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error('缺少必要配置: accessKeyId, secretAccessKey, endpoint');
  }
  if (!bucket || !localFile || !remoteKey) {
    throw new Error('缺少必要配置: bucket, localFile, remoteKey');
  }

  // 检查文件是否存在
  if (!fs.existsSync(localFile)) {
    throw new Error(`文件不存在: ${localFile}`);
  }

  // 创建 S3 客户端
  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  const fileStats = fs.statSync(localFile);
  const fileStream = fs.createReadStream(localFile);

  log(`📁 准备上传: ${localFile}`);
  log(`📊 文件大小: ${formatBytes(fileStats.size)}`);

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: remoteKey,
      Body: fileStream,
      ContentType: contentType,
    },
  });

  upload.on('httpUploadProgress', (progress) => {
    if (onProgress) {
      onProgress(progress.loaded, fileStats.size);
    } else if (!silent) {
      renderProgress(progress.loaded, fileStats.size);
    }
  });

  await upload.done();

  if (!silent) console.log('');
  log('✅ 上传成功!');

  const result = {};
  if (publicUrl) {
    result.url = `${publicUrl}/${remoteKey}`;
    log(`🔗 访问地址: ${result.url}`);
  }

  return result;
}
