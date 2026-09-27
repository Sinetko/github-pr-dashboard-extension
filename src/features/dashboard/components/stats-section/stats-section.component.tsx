import { Collapsible } from '@shared/ui';

import { STAT_TILES } from './stats-section.model';
import { StatsRoot, Tile, TileGrid, TileLabel, TileValue } from './stats-section.styles';

import type { StatsSectionProps } from './stats-section.types';
import type { FC } from 'react';

export const StatsSection: FC<StatsSectionProps> = ({ stats, isCollapsed, onToggle }) => (
  <StatsRoot>
    <Collapsible id="dashboard-stats" title="Overview" isOpen={!isCollapsed} onToggle={onToggle}>
      <TileGrid>
        {STAT_TILES.map((tile) => (
          <Tile key={tile.key}>
            <TileLabel>{tile.label}</TileLabel>
            <TileValue>{stats[tile.key]}</TileValue>
          </Tile>
        ))}
      </TileGrid>
    </Collapsible>
  </StatsRoot>
);
