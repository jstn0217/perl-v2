export interface ImageUpload {
  buffer: Buffer;
  contentType: string;
  key: string;
}

export interface IImageStorage {
  upload(upload: ImageUpload): Promise<string>;
}
