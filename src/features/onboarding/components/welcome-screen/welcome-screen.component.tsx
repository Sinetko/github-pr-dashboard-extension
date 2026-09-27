import { Button, Screen } from '@shared/ui';

import { WELCOME_POINTS } from './welcome-screen.model';
import { PointBody, PointList, PointTitle } from './welcome-screen.styles';

import type { WelcomeScreenProps } from './welcome-screen.types';
import type { FC } from 'react';

export const WelcomeScreen: FC<WelcomeScreenProps> = ({ onContinue }) => (
  <Screen
    title="Welcome to PR Dashboard"
    description="A read-only dashboard for your GitHub pull requests."
    footer={
      <Button variant="primary" onClick={onContinue}>
        Get started
      </Button>
    }
  >
    <PointList>
      {WELCOME_POINTS.map((point) => (
        <li key={point.title}>
          <PointTitle>{point.title}</PointTitle>
          <PointBody>{point.body}</PointBody>
        </li>
      ))}
    </PointList>
  </Screen>
);
