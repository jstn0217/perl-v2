import type { CSSProperties } from 'react';

interface SchoolMarkProps {
  name: string;
  logoUrl: string | null;
  compact?: boolean;
  style?: CSSProperties;
}

export const SchoolMark = ({
  name,
  logoUrl,
  compact = false,
  style
}: SchoolMarkProps) => {
  const className = `school-mark${compact ? ' school-mark--compact' : ''}`;

  if (logoUrl) {
    return <img className={className} src={logoUrl} alt={`${name} logo`} style={style} />;
  }

  return (
    <div
      className={`${className} school-mark--fallback`}
      style={style}
      aria-label={`${name} initials`}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
};
