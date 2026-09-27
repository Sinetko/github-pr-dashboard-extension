import { useCallback, useMemo, type FC, type MouseEvent } from 'react';

import { Avatar, Pill } from '@shared/ui';
import { formatRelativeTime } from '@shared/utils';

import { approvalLabel, statusPills } from './pull-request-item.model';
import {
  ItemBody,
  ItemLink,
  ItemRoot,
  LabelChip,
  Meta,
  PillRow,
  Title,
} from './pull-request-item.styles';

import type { PullRequestItemProps } from './pull-request-item.types';

const MAX_LABELS = 3;

export const PullRequestItem: FC<PullRequestItemProps> = ({ item, now, onOpen }) => {
  const { pullRequest, flags } = item;
  const pills = useMemo(() => statusPills(flags, pullRequest.checks), [flags, pullRequest.checks]);
  const approvals = approvalLabel(flags.approvals);
  const authorName = pullRequest.author?.login ?? 'ghost';

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      onOpen(pullRequest.htmlUrl);
    },
    [onOpen, pullRequest.htmlUrl],
  );

  return (
    <ItemRoot>
      <ItemLink href={pullRequest.htmlUrl} onClick={handleClick}>
        <Avatar src={pullRequest.author?.avatarUrl ?? null} name={authorName} size={24} />
        <ItemBody>
          <Title>{pullRequest.title}</Title>
          <Meta>
            {pullRequest.repository.owner}/{pullRequest.repository.name} #{pullRequest.number} ·{' '}
            {authorName} · opened {formatRelativeTime(pullRequest.createdAt, now)} · updated{' '}
            {formatRelativeTime(pullRequest.updatedAt, now)}
          </Meta>
          <PillRow>
            {pills.map((pill) => (
              <Pill key={pill.key} tone={pill.tone} title={pill.title}>
                {pill.label}
              </Pill>
            ))}
            {approvals === null ? null : (
              <Pill
                tone={
                  flags.approvals.required !== null &&
                  flags.approvals.approved >= flags.approvals.required
                    ? 'success'
                    : 'neutral'
                }
                title="Approving reviews"
              >
                ✓ {approvals}
              </Pill>
            )}
            {pullRequest.unresolvedThreadCount > 0 ? (
              <Pill title="Unresolved review threads">
                💬 {pullRequest.unresolvedThreadCount} unresolved
              </Pill>
            ) : null}
            {pullRequest.labels.slice(0, MAX_LABELS).map((label) => (
              <LabelChip
                key={label.name}
                $color={label.color}
                title={label.description ?? label.name}
              >
                {label.name}
              </LabelChip>
            ))}
          </PillRow>
        </ItemBody>
      </ItemLink>
    </ItemRoot>
  );
};
