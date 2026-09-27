import type { TokenKind, Viewer } from '@core/github';

export const scopeWarnings = (viewer: Viewer, tokenKind: TokenKind): string[] => {
  if (viewer.scopes === null || tokenKind === 'fine-grained') {
    return [];
  }
  const warnings: string[] = [];
  if (!viewer.scopes.includes('repo')) {
    warnings.push(
      viewer.scopes.includes('public_repo')
        ? 'Only public repositories are visible (token has public_repo, not repo).'
        : 'No repo scope: private repositories will not be visible.',
    );
  }
  if (!viewer.scopes.some((scope) => scope === 'read:org' || scope === 'admin:org')) {
    warnings.push(
      'No read:org scope: review requests to your teams will not count as "needs my review".',
    );
  }
  return warnings;
};

export const DRAFT_DEBOUNCE_MILLISECONDS = 300;
