import { toHex, utf8 } from './bytes';

export interface FingerprintSources {
  platform: string;
  hardwareConcurrency: number;
  extensionId: string;
  architecture: string;
  bitness: string;
  model: string;
}

export const FINGERPRINT_VERSION = 1;

interface HighEntropyHints {
  architecture?: string;
  bitness?: string;
  model?: string;
  platform?: string;
}

interface UserAgentDataLike {
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<HighEntropyHints>;
}

export const collectFingerprintSources = async (
  navigatorLike: Pick<Navigator, 'platform' | 'hardwareConcurrency'> & {
    userAgentData?: UserAgentDataLike;
  },
  extensionId: string,
): Promise<FingerprintSources> => {
  const userAgentData = navigatorLike.userAgentData;
  let hints: HighEntropyHints = {};
  if (userAgentData?.getHighEntropyValues !== undefined) {
    try {
      hints = await userAgentData.getHighEntropyValues(['architecture', 'bitness', 'model']);
    } catch {
      hints = {};
    }
  }
  return {
    platform: userAgentData?.platform ?? hints.platform ?? navigatorLike.platform,
    hardwareConcurrency: navigatorLike.hardwareConcurrency,
    extensionId,
    architecture: hints.architecture ?? '',
    bitness: hints.bitness ?? '',
    model: hints.model ?? '',
  };
};

export const computeFingerprint = async (sources: FingerprintSources): Promise<string> => {
  const canonical = JSON.stringify([
    `fp-v${FINGERPRINT_VERSION}`,
    sources.platform,
    sources.hardwareConcurrency,
    sources.extensionId,
    sources.architecture,
    sources.bitness,
    sources.model,
  ]);
  return toHex(await crypto.subtle.digest('SHA-256', utf8(canonical)));
};
