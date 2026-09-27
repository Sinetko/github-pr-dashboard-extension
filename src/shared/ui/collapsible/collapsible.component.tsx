import { useCallback, type FC } from 'react';

import { Chevron, CollapsibleHeader } from './collapsible.styles';

import type { CollapsibleProps } from './collapsible.types';

export const Collapsible: FC<CollapsibleProps> = ({ id, title, isOpen, onToggle, children }) => {
  const handleClick = useCallback(() => {
    onToggle(!isOpen);
  }, [isOpen, onToggle]);
  const contentId = `${id}-content`;
  return (
    <section>
      <CollapsibleHeader
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={handleClick}
      >
        <Chevron $isOpen={isOpen} aria-hidden="true">
          ▸
        </Chevron>
        {title}
      </CollapsibleHeader>
      <div id={contentId} hidden={!isOpen}>
        {isOpen ? children : null}
      </div>
    </section>
  );
};
