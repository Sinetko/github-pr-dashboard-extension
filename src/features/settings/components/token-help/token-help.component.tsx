import { Button, SegmentedControl, Stack } from '@shared/ui';

import { TOKEN_KIND_OPTIONS, TOKEN_SCOPE_HELP } from './token-help.model';
import { HelpRoot, ScopeList } from './token-help.styles';

import type { TokenHelpProps } from './token-help.types';
import type { FC } from 'react';

export const TokenHelp: FC<TokenHelpProps> = ({
  tokenKind,
  onTokenKindChange,
  onOpenTokenPage,
}) => (
  <HelpRoot>
    <Stack direction="row" justify="space-between" align="center" wrap>
      <SegmentedControl
        label="Token type"
        options={TOKEN_KIND_OPTIONS}
        value={tokenKind}
        onChange={onTokenKindChange}
      />
      <Button size="sm" onClick={onOpenTokenPage}>
        Create token on GitHub ↗
      </Button>
    </Stack>
    <ScopeList aria-label="Required token permissions">
      {TOKEN_SCOPE_HELP[tokenKind].map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ScopeList>
  </HelpRoot>
);
