import { useCallback, useState, type FC } from 'react';

import { initialsFor } from './avatar.model';
import { AvatarFallback, AvatarImage } from './avatar.styles';

import type { AvatarProps } from './avatar.types';

export const Avatar: FC<AvatarProps> = ({ src, name, size = 20 }) => {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const handleError = useCallback(() => {
    setFailedSource(src ?? null);
  }, [src]);

  if (src === undefined || src === null || src === '' || failedSource === src) {
    return (
      <AvatarFallback $size={size} role="img" aria-label={name}>
        {initialsFor(name)}
      </AvatarFallback>
    );
  }
  return (
    <AvatarImage
      $size={size}
      src={src}
      alt={name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={handleError}
    />
  );
};
