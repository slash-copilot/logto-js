export type { LogtoContextProps } from './context.js';

export type {
  LogtoConfig,
  IdTokenClaims,
  UserInfoResponse,
  LogtoErrorCode,
  LogtoClientErrorCode,
  InteractionMode,
} from '@slash-copilot/browser';

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
} from '@slash-copilot/browser';

export * from './provider.js';

export { useLogto, useHandleSignInCallback } from './hooks/index.js';
