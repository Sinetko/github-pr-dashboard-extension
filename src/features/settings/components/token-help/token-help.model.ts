import type { TokenKind } from '@core/github';

export const TOKEN_KIND_OPTIONS: readonly { value: TokenKind; label: string }[] = [
  { value: 'fine-grained', label: 'Fine-grained' },
  { value: 'classic', label: 'Classic' },
];

export const TOKEN_SCOPE_HELP: Record<TokenKind, readonly string[]> = {
  'fine-grained': [
    'Repository access: only the repositories you want to track.',
    'Repository permissions (read-only): Pull requests, Commit statuses, Checks, Contents, Metadata.',
    'Optional — Organization permissions: Members (read) so team review requests count.',
  ],
  classic: [
    'repo — read private repositories (use public_repo if you only track public ones).',
    'Optional — read:org so review requests to your teams count as "needs my review".',
  ],
};
