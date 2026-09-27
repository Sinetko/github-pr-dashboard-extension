export interface BiometricOfferScreenProps {
  onEnroll: () => Promise<void>;
  onSkip: () => void;
}
