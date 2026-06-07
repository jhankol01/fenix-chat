import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import config from '../config/index.js'
import crypto from 'crypto'

const s3 = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION || 'eu-central-003',
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
  forcePathStyle: true,
})

const BUCKET = process.env.B2_BUCKET_NAME

/**
 * Upload a buffer to Backblaze B2 and return the public URL
 * @param {Buffer} buffer - file buffer
 * @param {string} folder - e.g. 'avatars'
 * @param {string} mimeType - e.g. 'image/webp'
 * @returns {string} public URL
 */
export async function uploadToB2(buffer, folder, mimeType) {
  const extMap = {
    'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
    'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3',
  }
  const ext = extMap[mimeType] || mimeType.split('/')[1] || 'bin'
  const filename = `${folder}/${crypto.randomUUID()}.${ext}`

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: filename,
    Body: buffer,
    ContentType: mimeType,
    ACL: 'public-read',
  }))

  // Public URL format for B2
  const url = `${process.env.B2_ENDPOINT}/${BUCKET}/${filename}`
  return url
}

export default { uploadToB2 }
