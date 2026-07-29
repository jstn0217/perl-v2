import { useState } from 'react';
import type { AttendanceDisplayStudent } from '../types/attendance';

interface StudentAvatarProps {
  student: AttendanceDisplayStudent | null;
  variant?: 'thumbnail' | 'live';
}

export const StudentAvatar = ({
  student,
  variant = 'thumbnail'
}: StudentAvatarProps) => {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const className = variant === 'live' ? 'live-student-photo' : 'student-avatar';
  const imageUrl = student?.imageUrl ?? null;

  if (student && imageUrl && imageUrl !== failedImageUrl) {
    return (
      <img
        className={className}
        src={imageUrl}
        alt={`${student.firstName} ${student.lastName}`}
        onError={() => setFailedImageUrl(imageUrl)}
      />
    );
  }

  const initials = student
    ? `${student.firstName.slice(0, 1)}${student.lastName.slice(0, 1)}`
    : '??';
  const fallbackClassName = variant === 'live'
    ? `${className} live-student-photo--fallback`
    : `${className} student-avatar--fallback`;

  return (
    <div className={fallbackClassName} aria-hidden="true">
      {initials.toUpperCase()}
    </div>
  );
};
