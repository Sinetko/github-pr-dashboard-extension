import { useCallback, useRef, type KeyboardEvent, type ReactElement } from 'react';

import { nextTabIndex, panelId, tabId } from './tabs.model';
import { TabButton, TabCount, TabList } from './tabs.styles';

import type { TabsProps } from './tabs.types';

export const Tabs = <TValue extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
}: TabsProps<TValue>): ReactElement => {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = items.findIndex((item) => item.value === value);
      const targetIndex = nextTabIndex(event.key, Math.max(currentIndex, 0), items.length);
      const target = targetIndex === null ? undefined : items[targetIndex];
      if (target === undefined) {
        return;
      }
      event.preventDefault();
      onChange(target.value);
      listRef.current
        ?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(idPrefix, target.value))}`)
        ?.focus();
    },
    [items, value, onChange, idPrefix],
  );

  return (
    <TabList ref={listRef} role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
      {items.map((item) => {
        const isSelected = item.value === value;
        return (
          <TabButton
            key={item.value}
            id={tabId(idPrefix, item.value)}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={panelId(idPrefix, item.value)}
            aria-label={item.count === undefined ? undefined : `${item.label} (${item.count})`}
            tabIndex={isSelected ? 0 : -1}
            $isSelected={isSelected}
            onClick={() => {
              onChange(item.value);
            }}
          >
            {item.label}
            {item.count === undefined ? null : <TabCount>{item.count}</TabCount>}
          </TabButton>
        );
      })}
    </TabList>
  );
};
