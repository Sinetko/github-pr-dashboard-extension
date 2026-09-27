import { PullRequestItem } from '../pull-request-item';
import { List } from './pull-request-list.styles';

import type { PullRequestListProps } from './pull-request-list.types';
import type { FC } from 'react';

export const PullRequestList: FC<PullRequestListProps> = ({ items, now, onOpen }) => (
  <List aria-label="Pull requests">
    {items.map((item) => (
      <PullRequestItem key={item.pullRequest.id} item={item} now={now} onOpen={onOpen} />
    ))}
  </List>
);
