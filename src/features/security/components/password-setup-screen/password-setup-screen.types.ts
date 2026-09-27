export interface PasswordSetupScreenProps {
  onSetup: (password: string) => Promise<void>;
  generatePassword: () => string;
}
