import { IconButton, Screen, Stack } from '@shared/ui';

import { Muted, Paragraph, SectionTitle } from './about-panel.styles';

import type { AboutPanelProps } from './about-panel.types';
import type { FC } from 'react';

export const AboutPanel: FC<AboutPanelProps> = ({ version, onClose }) => (
  <Screen
    title="About"
    description={`PR Dashboard ${version}`}
    headerAction={<IconButton label="Close about" icon="✕" onClick={onClose} />}
  >
    <Stack gap="md">
      <SectionTitle>How your token is protected</SectionTitle>
      <Paragraph>
        Your personal access token is encrypted with AES-GCM using a random data key. That key is
        itself encrypted with a key derived (PBKDF2, 600,000 rounds) from your vault password plus
        characteristics of this device, and optionally with a key released by your device's
        biometric authenticator (WebAuthn PRF).
      </Paragraph>
      <Paragraph>
        While unlocked, only the data key is held in the browser's session storage, which is cleared
        when the browser quits. The plaintext token is never stored — it's decrypted for each
        request and discarded.
      </Paragraph>
      <SectionTitle>What this extension does</SectionTitle>
      <Paragraph>
        It reads pull requests, reviews and checks from the GitHub API with your own token. It is
        read-only: it never merges, approves, comments on or closes anything. It talks only to
        api.github.com, or to the GitHub Enterprise Server host you configure.
      </Paragraph>
      <Muted>
        Not affiliated with or endorsed by GitHub. Use a token with the minimum permissions you
        need, and revoke it on GitHub if you stop using the extension.
      </Muted>
    </Stack>
  </Screen>
);
