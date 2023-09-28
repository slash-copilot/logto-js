import { conditionalString } from '@silverhand/essentials';
import { discoveryPath } from '@slash-copilot/js';

export * from './requester.js';

export const buildAccessTokenKey = (
  resource = '',
  organizationId?: string,
  scopes: string[] = []
): string =>
  `${scopes.slice().sort().join(' ')}@${resource}${conditionalString(
    organizationId && `#${organizationId}`
  )}`;

export const getDiscoveryEndpoint = (endpoint: string): string =>
  new URL(discoveryPath, endpoint).toString();
