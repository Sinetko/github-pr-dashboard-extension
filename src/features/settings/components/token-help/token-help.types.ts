import type { TokenKind } from '@core/github';

export interface TokenHelpProps {
  tokenKind: TokenKind;
  onTokenKindChange: (kind: TokenKind) => void;
  onOpenTokenPage: () => void;
}
