import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { IImageStorage, ImageUpload } from './IImageStorage.js';

interface AwsS3ImageStorageOptions {
  region: string;
  bucket: string;
  publicBaseUrl?: string;
}

const encodeKey = (key: string) => key.split('/').map(encodeURIComponent).join('/');

export class AwsS3ImageStorage implements IImageStorage {
  private readonly client: S3Client;

  constructor(private readonly options: AwsS3ImageStorageOptions) {
    this.client = new S3Client({ region: options.region });
  }

  async upload({ buffer, contentType, key }: ImageUpload): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable'
      })
    );

    const baseUrl = this.options.publicBaseUrl?.replace(/\/$/, '') ??
      `https://${this.options.bucket}.s3.${this.options.region}.amazonaws.com`;

    return `${baseUrl}/${encodeKey(key)}`;
  }
}
