import type { LogtoConfig, ClientAdapter } from '@slash-copilot/client';
import { createRequester } from '@slash-copilot/client';
import fetch from 'node-fetch';

import BaseClient from './client.js';
import { generateCodeChallenge, generateCodeVerifier, generateState } from './utils/generators.js';

export type { LogtoContext, GetContextParameters } from './types.js';

export type {
  IdTokenClaims,
  LogtoErrorCode,
  LogtoConfig,
  LogtoClientErrorCode,
  Storage,
  StorageKey,
  InteractionMode,
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

export default class LogtoClient extends BaseClient {
  constructor(config: LogtoConfig, adapter: Pick<ClientAdapter, 'navigate' | 'storage'>) {
    super(config, {
      ...adapter,
      requester: createRequester(
        config.appSecret
          ? async (...args: Parameters<typeof fetch>) => {
              const [input, init] = args;

              return fetch(input, {
                ...init,
                headers: {
                  Authorization: `Basic ${Buffer.from(
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    `${config.appId}:${config.appSecret}`,
                    'utf8'
                  ).toString('base64')}`,
                  ...init?.headers,
                },
              });
            }
          : fetch
      ),
      generateCodeChallenge,
      generateCodeVerifier,
      generateState,
    });
  }
}
