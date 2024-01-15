/* eslint-disable max-lines */
import {
  type IdTokenClaims,
  type UserInfoResponse,
  type InteractionMode,
  type AccessTokenClaims,
  decodeAccessToken,
  decodeIdToken,
  fetchOidcConfig,
  fetchTokenByAuthorizationCode,
  fetchTokenByRefreshToken,
  fetchUserInfo,
  generateSignInUri,
  generateSignOutUri,
  revoke,
  verifyAndParseCodeFromCallbackUri,
  verifyIdToken,
  type OidcConfigResponse,
  UserScope,
} from '@slash-copilot/js';
import { type Optional, type Nullable } from '@silverhand/essentials';
import { type JWTVerifyGetKey, createRemoteJWKSet } from 'jose';

import {
  CacheKey,
  ClientAdapterInstance,
  type ClientAdapter,
  PersistKey,
} from './adapter/index.js';
import { LogtoClientError } from './errors.js';
import { CachedRemoteJwkSet } from './remote-jwk-set.js';
import type { AccessToken, LogtoConfig, LogtoSignInSessionItem } from './types/index.js';
import {
  isLogtoAccessTokenMap,
  isLogtoSignInSessionItem,
  normalizeLogtoConfig,
} from './types/index.js';
import { buildAccessTokenKey, getDiscoveryEndpoint } from './utils/index.js';
import { memoize } from './utils/memoize.js';
import { once } from './utils/once.js';

export type { IdTokenClaims, LogtoErrorCode, UserInfoResponse, InteractionMode } from '@slash-copilot/js';
export {
  LogtoError,
  LogtoRequestError,
  OidcError,
  Prompt,
  ReservedScope,
  ReservedResource,
  UserScope,
  organizationUrnPrefix,
  buildOrganizationUrn,
  getOrganizationIdFromUrn,
} from '@slash-copilot/js';
export * from './errors.js';
export type { Storage, StorageKey, ClientAdapter } from './adapter/index.js';
export { PersistKey, CacheKey } from './adapter/index.js';
export { createRequester } from './utils/index.js';
export * from './types/index.js';

/**
 * The Logto base client class that provides the essential methods for
 * interacting with the Logto server.
 *
 * It also provides an adapter object that allows the customizations of the
 * client behavior for different environments.
 */
export default class LogtoClient {
  readonly logtoConfig: LogtoConfig;
  /**
   * Get the OIDC configuration from the discovery endpoint. This method will
   * only fetch the configuration once and cache the result.
   */
  readonly getOidcConfig: () => Promise<OidcConfigResponse> = once(this._getOidcConfig);
  /**
   * Get the access token from the storage with refresh strategy.
   *
   * - If the access token has expired, it will try to fetch a new one using the Refresh Token.
   * - If there's an ongoing Promise to fetch the access token, it will return the Promise.
   *
   * If you want to get the access token claims, use {@link getAccessTokenClaims} instead.
   *
   * @param resource The resource that the access token is granted for. If not
   * specified, the access token will be used for OpenID Connect or the default
   * resource, as specified in the Logto Console.
   * @returns The access token string.
   * @throws LogtoClientError if the user is not authenticated.
   */
  readonly getAccessToken = memoize(this._getAccessToken);

  /**
   * Get the access token for the specified organization from the storage with refresh strategy.
   *
   * Scope {@link UserScope.Organizations} is required in the config to use organization-related
   * methods.
   *
   * @param organizationId The ID of the organization that the access token is granted for.
   * @returns The access token string.
   * @throws LogtoClientError if the user is not authenticated.
   * @remarks
   * It uses the same refresh strategy as {@link getAccessToken}.
   */
  readonly getOrganizationToken = memoize(this._getOrganizationToken);

  /**
   * Handle the sign-in callback by parsing the authorization code from the
   * callback URI and exchanging it for the tokens.
   *
   * @param callbackUri The callback URI, including the search params, that the user is redirected to after the sign-in flow is completed.
   * The origin and pathname of this URI must match the origin and pathname of the redirect URI specified in {@link signIn}.
   * In many cases you'll probably end up passing `window.location.href` as the argument to this function.
   * @throws LogtoClientError if the sign-in session is not found.
   */
  readonly handleSignInCallback = memoize(this._handleSignInCallback);

  protected readonly getJwtVerifyGetKey = once(this._getJwtVerifyGetKey);
  protected readonly adapter: ClientAdapterInstance;
  protected readonly accessTokenMap = new Map<string, AccessToken>();

  constructor(logtoConfig: LogtoConfig, adapter: ClientAdapter) {
    this.logtoConfig = normalizeLogtoConfig(logtoConfig);
    this.adapter = new ClientAdapterInstance(adapter);

    void this.loadAccessTokenMap();
  }

  /**
   * Check if the user is authenticated by checking if the ID token exists.
   */
  async isAuthenticated() {
    return Boolean(await this.getIdToken());
  }

  /**
   * Get the Refresh Token from the storage.
   */
  async getRefreshToken() {
    return this.adapter.storage.getItem('refreshToken');
  }

  /**
   * Get the ID Token from the storage. If you want to get the ID Token claims,
   * use {@link getIdTokenClaims} instead.
   */
  async getIdToken() {
    return this.adapter.storage.getItem('idToken');
  }

  /**
   * Get the ID Token claims.
   */
  async getIdTokenClaims(): Promise<IdTokenClaims> {
    const idToken = await this.getIdToken();

    if (!idToken) {
      throw new LogtoClientError('not_authenticated');
    }

    return decodeIdToken(idToken);
  }

  /**
   * Get the access token claims for the specified resource.
   *
   * @param resource The resource that the access token is granted for. If not
   * specified, the access token will be used for OpenID Connect or the default
   * resource, as specified in the Logto Console.
   */
  async getAccessTokenClaims(resource?: string): Promise<AccessTokenClaims> {
    const accessToken = await this.getAccessToken(resource);

    return decodeAccessToken(accessToken);
  }

  /**
   * Get the organization token claims for the specified organization.
   *
   * @param organizationId The ID of the organization that the access token is granted for.
   */
  async getOrganizationTokenClaims(organizationId: string): Promise<AccessTokenClaims> {
    const accessToken = await this.getOrganizationToken(organizationId);

    return decodeAccessToken(accessToken);
  }

  /**
   * Get the user information from the Userinfo Endpoint.
   *
   * Note the Userinfo Endpoint will return more claims than the ID Token. See
   * {@link https://docs.logto.io/docs/recipes/integrate-logto/vanilla-js/#fetch-user-information | Fetch user information}
   * for more information.
   *
   * @returns The user information.
   * @throws LogtoClientError if the user is not authenticated.
   */
  async fetchUserInfo(): Promise<UserInfoResponse> {
    const { userinfoEndpoint } = await this.getOidcConfig();
    const accessToken = await this.getAccessToken();

    if (!accessToken) {
      throw new LogtoClientError('fetch_user_info_failed');
    }

    return fetchUserInfo(userinfoEndpoint, accessToken, this.adapter.requester);
  }

  /**
   * Start the sign-in flow with the specified redirect URI. The URI must be
   * registered in the Logto Console.
   *
   * The user will be redirected to that URI after the sign-in flow is completed,
   * and the client will be able to get the authorization code from the URI.
   * To fetch the tokens from the authorization code, use {@link handleSignInCallback}
   * after the user is redirected in the callback URI.
   *
   * @param redirectUri The redirect URI that the user will be redirected to after the sign-in flow is completed.
   * @param interactionMode The interaction mode to be used for the authorization request. Note it's not
   * a part of the OIDC standard, but a Logto-specific extension. Defaults to `signIn`.
   *
   * @see {@link https://docs.logto.io/docs/recipes/integrate-logto/vanilla-js/#sign-in | Sign in} for more information.
   * @see {@link InteractionMode}
   */
  async signIn(
    redirectUri: string,
    interactionMode?: InteractionMode,
    inviteCode?: string
  ): Promise<void> {
    const { appId: clientId, prompt, resources, scopes } = this.logtoConfig;
    const { authorizationEndpoint } = await this.getOidcConfig();
    const codeVerifier = this.adapter.generateCodeVerifier();
    const codeChallenge = await this.adapter.generateCodeChallenge(codeVerifier);
    const state = this.adapter.generateState();

    const signInUri = generateSignInUri({
      authorizationEndpoint,
      clientId,
      redirectUri,
      codeChallenge,
      state,
      scopes,
      resources,
      prompt,
      interactionMode,
      inviteCode,
    });

    await Promise.all([
      this.setSignInSession({ redirectUri, codeVerifier, state }),
      this.setRefreshToken(null),
      this.setIdToken(null),
    ]);
    await this.adapter.navigate(signInUri);
  }

  /**
   * Check if the user is redirected from the sign-in page by checking if the
   * current URL matches the redirect URI in the sign-in session.
   *
   * If there's no sign-in session, it will return `false`.
   *
   * @param url The current URL.
   */
  async isSignInRedirected(url: string): Promise<boolean> {
    const signInSession = await this.getSignInSession();

    if (!signInSession) {
      return false;
    }
    const { redirectUri } = signInSession;
    const { origin, pathname } = new URL(url);

    return `${origin}${pathname}` === redirectUri;
  }

  /**
   * Start the sign-out flow with the specified redirect URI. The URI must be
   * registered in the Logto Console.
   *
   * It will also revoke all the tokens and clean up the storage.
   *
   * The user will be redirected that URI after the sign-out flow is completed.
   * If the `postLogoutRedirectUri` is not specified, the user will be redirected
   * to a default page.
   */
  async signOut(postLogoutRedirectUri?: string): Promise<void> {
    const { appId: clientId } = this.logtoConfig;
    const { endSessionEndpoint, revocationEndpoint } = await this.getOidcConfig();
    const refreshToken = await this.getRefreshToken();

    if (refreshToken) {
      try {
        await revoke(revocationEndpoint, clientId, refreshToken, this.adapter.requester);
      } catch {
        // Do nothing at this point, as we don't want to break the sign-out flow even if the revocation is failed
      }
    }

    const url = generateSignOutUri({
      endSessionEndpoint,
      postLogoutRedirectUri,
      clientId,
    });

    this.accessTokenMap.clear();

    await Promise.all([
      this.setRefreshToken(null),
      this.setIdToken(null),
      this.adapter.storage.removeItem('accessToken'),
    ]);
    await this.adapter.navigate(url);
  }

  protected async getSignInSession(): Promise<Nullable<LogtoSignInSessionItem>> {
    const jsonItem = await this.adapter.storage.getItem('signInSession');

    if (!jsonItem) {
      return null;
    }

    const item: unknown = JSON.parse(jsonItem);

    if (!isLogtoSignInSessionItem(item)) {
      throw new LogtoClientError('sign_in_session.invalid');
    }

    return item;
  }

  protected async setSignInSession(value: Nullable<LogtoSignInSessionItem>) {
    return this.adapter.setStorageItem(PersistKey.SignInSession, value && JSON.stringify(value));
  }

  private async setIdToken(value: Nullable<string>) {
    return this.adapter.setStorageItem(PersistKey.IdToken, value);
  }

  private async setRefreshToken(value: Nullable<string>) {
    return this.adapter.setStorageItem(PersistKey.RefreshToken, value);
  }

  private async getAccessTokenByRefreshToken(
    resource: Optional<string>,
    organizationId: Optional<string>
  ): Promise<string> {
    const currentRefreshToken = await this.getRefreshToken();

    if (!currentRefreshToken) {
      throw new LogtoClientError('not_authenticated');
    }

    const accessTokenKey = buildAccessTokenKey(resource, organizationId);
    const { appId: clientId } = this.logtoConfig;
    const { tokenEndpoint } = await this.getOidcConfig();
    const requestedAt = Math.round(Date.now() / 1000);
    const { accessToken, refreshToken, idToken, scope, expiresIn } = await fetchTokenByRefreshToken(
      {
        clientId,
        tokenEndpoint,
        refreshToken: currentRefreshToken,
        resource,
        organizationId,
      },
      this.adapter.requester
    );

    this.accessTokenMap.set(accessTokenKey, {
      token: accessToken,
      scope,
      /** The `expiresAt` variable provides an approximate estimation of the actual `exp` property
       * in the token claims. It is utilized by the client to determine if the cached access token
       * has expired and when a new access token should be requested.
       */
      expiresAt: requestedAt + expiresIn,
    });

    await this.saveAccessTokenMap();

    if (refreshToken) {
      await this.setRefreshToken(refreshToken);
    }

    if (idToken) {
      await this.verifyIdToken(idToken);
      await this.setIdToken(idToken);
    }

    return accessToken;
  }

  private async verifyIdToken(idToken: string) {
    const { appId } = this.logtoConfig;
    const { issuer } = await this.getOidcConfig();
    const jwtVerifyGetKey = await this.getJwtVerifyGetKey();

    await verifyIdToken(idToken, appId, issuer, jwtVerifyGetKey);
  }

  private async saveAccessTokenMap() {
    const data: Record<string, AccessToken> = {};

    for (const [key, accessToken] of this.accessTokenMap.entries()) {
      // eslint-disable-next-line @silverhand/fp/no-mutation
      data[key] = accessToken;
    }

    await this.adapter.storage.setItem('accessToken', JSON.stringify(data));
  }

  private async loadAccessTokenMap() {
    const raw = await this.adapter.storage.getItem('accessToken');

    if (!raw) {
      return;
    }

    try {
      const json: unknown = JSON.parse(raw);

      if (!isLogtoAccessTokenMap(json)) {
        return;
      }
      this.accessTokenMap.clear();

      for (const [key, accessToken] of Object.entries(json)) {
        this.accessTokenMap.set(key, accessToken);
      }
    } catch (error: unknown) {
      console.warn(error);
    }
  }

  async _getOidcConfig(): Promise<OidcConfigResponse> {
    return this.adapter.getWithCache(CacheKey.OpenidConfig, async () => {
      return fetchOidcConfig(
        getDiscoveryEndpoint(this.logtoConfig.endpoint),
        this.adapter.requester
      );
    });
  }

  async _getJwtVerifyGetKey(): Promise<JWTVerifyGetKey> {
    const { jwksUri } = await this.getOidcConfig();

    if (!this.adapter.unstable_cache) {
      return createRemoteJWKSet(new URL(jwksUri));
    }

    const cachedJwkSet = new CachedRemoteJwkSet(new URL(jwksUri), this.adapter);
    return async (...args) => cachedJwkSet.getKey(...args);
  }

  async _getAccessToken(resource?: string, organizationId?: string): Promise<string> {
    if (!(await this.isAuthenticated())) {
      throw new LogtoClientError('not_authenticated');
    }

    const accessTokenKey = buildAccessTokenKey(resource, organizationId);
    const accessToken = this.accessTokenMap.get(accessTokenKey);

    if (accessToken && accessToken.expiresAt > Date.now() / 1000) {
      return accessToken.token;
    }

    // Since the access token has expired, delete it from the map.
    if (accessToken) {
      this.accessTokenMap.delete(accessTokenKey);
    }

    /**
     * Need to fetch a new access token using refresh token.
     */
    return this.getAccessTokenByRefreshToken(resource, organizationId);
  }

  async _getOrganizationToken(organizationId: string): Promise<string> {
    if (!this.logtoConfig.scopes?.includes(UserScope.Organizations)) {
      throw new LogtoClientError('missing_scope_organizations');
    }

    return this.getAccessToken(undefined, organizationId);
  }

  async _handleSignInCallback(callbackUri: string) {
    const { requester } = this.adapter;
    const signInSession = await this.getSignInSession();

    if (!signInSession) {
      throw new LogtoClientError('sign_in_session.not_found');
    }

    const { redirectUri, state, codeVerifier } = signInSession;
    const code = verifyAndParseCodeFromCallbackUri(callbackUri, redirectUri, state);

    // NOTE: Will add scope to accessTokenKey when needed. (Linear issue LOG-1589)
    const accessTokenKey = buildAccessTokenKey();
    const { appId: clientId } = this.logtoConfig;
    const { tokenEndpoint } = await this.getOidcConfig();
    const requestedAt = Math.round(Date.now() / 1000);
    const { idToken, refreshToken, accessToken, scope, expiresIn } =
      await fetchTokenByAuthorizationCode(
        {
          clientId,
          tokenEndpoint,
          redirectUri,
          codeVerifier,
          code,
        },
        requester
      );

    await this.verifyIdToken(idToken);
    await this.setRefreshToken(refreshToken ?? null);
    await this.setIdToken(idToken);

    this.accessTokenMap.set(accessTokenKey, {
      token: accessToken,
      scope,
      /** The `expiresAt` variable provides an approximate estimation of the actual `exp` property
       * in the token claims. It is utilized by the client to determine if the cached access token
       * has expired and when a new access token should be requested.
       */
      expiresAt: requestedAt + expiresIn,
    });
    await this.saveAccessTokenMap();
    await this.setSignInSession(null);
  }
}
/* eslint-enable max-lines */