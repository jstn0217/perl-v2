import { env } from '../config/env.js';
import { AwsS3ImageStorage } from './AwsS3ImageStorage.js';
import type { IImageStorage } from './IImageStorage.js';
import { MockImageStorage } from './MockImageStorage.js';

export const createImageStorage = (): IImageStorage => {
  if (env.imageStorage === 'mock') {
    return new MockImageStorage();
  }

  if (!env.aws.s3Bucket) {
    throw new Error('S3_BUCKET is required when IMAGE_STORAGE=s3.');
  }

  return new AwsS3ImageStorage({
    region: env.aws.region,
    bucket: env.aws.s3Bucket,
    publicBaseUrl: env.aws.s3PublicBaseUrl
  });
};

export type { IImageStorage } from './IImageStorage.js';
