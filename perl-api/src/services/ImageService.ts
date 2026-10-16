import { randomUUID } from 'node:crypto';
import type { ITenantRepository } from '../repositories/interfaces/ITenantRepository.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { IImageStorage } from '../storage/IImageStorage.js';
import type { SchoolProfile } from '../types/SchoolProfile.js';
import type { ManagedUserView } from './AdminService.js';
import { DomainError } from '../utils/errors.js';

interface UploadedImage {
  buffer: Buffer;
  contentType: string;
}

const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const hasExpectedSignature = ({ buffer, contentType }: UploadedImage) => {
  if (contentType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (contentType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }

  return contentType === 'image/webp' &&
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';
};

export class ImageService {
  constructor(
    private readonly imageStorage: IImageStorage,
    private readonly tenantRepository: ITenantRepository,
    private readonly userRepository: IUserRepository
  ) {}

  async uploadSchoolLogo(schoolId: string, image: UploadedImage): Promise<SchoolProfile> {
    const school = await this.tenantRepository.findSchoolById(schoolId);
    if (!school) throw new DomainError('School not found.', 404);

    const logoUrl = await this.storeImage(`schools/${schoolId}/logo`, image);
    const updated = await this.tenantRepository.updateSchoolProfile(schoolId, { logoUrl });
    if (!updated) throw new DomainError('School not found.', 404);

    return updated;
  }

  async uploadUserImage(schoolId: string, userId: string, image: UploadedImage): Promise<ManagedUserView> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.schoolId !== schoolId) throw new DomainError('User not found.', 404);

    const imageUrl = await this.storeImage(`schools/${schoolId}/users/${userId}`, image);
    const updated = await this.userRepository.update(userId, schoolId, { imageUrl });
    if (!updated) throw new DomainError('User not found.', 404);

    return {
      id: updated.id,
      schoolId: updated.schoolId,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      cardUid: updated.cardUid,
      gradeLevel: updated.gradeLevel,
      schoolIdNumber: updated.schoolIdNumber,
      section: updated.section,
      imageUrl: updated.imageUrl,
      phoneNumber: updated.phoneNumber ?? null,
      linkedStudentIds: updated.linkedStudentIds ?? [],
      isActive: updated.isActive,
      roleDefinitionId: updated.roleDefinitionId ?? null,
      addressLine1: updated.addressLine1,
      addressLine2: updated.addressLine2,
      barangay: updated.barangay,
      city: updated.city,
      province: updated.province,
      zipCode: updated.zipCode
    };
  }

  private async storeImage(prefix: string, image: UploadedImage): Promise<string> {
    const extension = extensions[image.contentType];
    if (!extension || !hasExpectedSignature(image)) {
      throw new DomainError('Uploaded file is not a valid JPEG, PNG, or WebP image.');
    }

    return this.imageStorage.upload({
      buffer: image.buffer,
      contentType: image.contentType,
      key: `${prefix}/${randomUUID()}.${extension}`
    });
  }
}
