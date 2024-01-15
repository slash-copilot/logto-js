import { conditional } from '@silverhand/essentials';
import type { LogtoConfig } from '@slash-copilot/client';
import BaseClient, { createRequester } from '@slash-copilot/client';

import { CacheStorage } from './cache.js';
import { BrowserStorage } from './storage.js';
import { generateCodeChallenge, generateCodeVerifier, generateState } from './utils/generators.js';

export { createRequester, default as BaseClient } from '@slash-copilot/client';
export { generateCodeChallenge, generateCodeVerifier, generateState } from './utils/generators.js';

export type {
  IdTokenClaims,
  LogtoErrorCode,
  LogtoConfig,
  LogtoClientErrorCode,
  UserInfoResponse,
  InteractionMode,
  ClientAdapter,
} from '@slash-copilot/client';

export {
  LogtoError,
  LogtoRequestError,
  LogtoClientError,
  OidcError,
  Prompt,
  ReservedScope,
  ReservedResource,
  UserScope,
  organizationUrnPrefix,
  buildOrganizationUrn,
  getOrganizationIdFromUrn,
  PersistKey,
} from '@slash-copilot/client';

const navigate = (url: string) => {
  window.location.assign(url);
};

export default class LogtoClient extends BaseClient {
  /**
   * @param config The configuration object for the client.
   * @param [unstable_enableCache=false] Whether to enable cache for well-known data.
   * Use sessionStorage by default.
   */
  constructor(config: LogtoConfig, unstable_enableCache = false) {
    const requester = createRequester(fetch);
    super(config, {
      requester,
      navigate,
      storage: new BrowserStorage(config.appId),
      unstable_cache: conditional(unstable_enableCache && new CacheStorage(config.appId)),
      generateCodeChallenge,
      generateCodeVerifier,
      generateState,
    });
  }
}
