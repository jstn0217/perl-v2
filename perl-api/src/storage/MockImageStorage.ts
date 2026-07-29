import type { IImageStorage, ImageUpload } from './IImageStorage.js';

export class MockImageStorage implements IImageStorage {
  async upload({ buffer, contentType }: ImageUpload): Promise<string> {
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  }
}
