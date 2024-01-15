import * as crypto from 'crypto';
import { type IncomingMessage, type ServerResponse } from 'http';

import NodeClient, { type GetContextParameters, type InteractionMode } from '@slash-copilot/node';
import {
  type GetServerSidePropsResult,
  type GetServerSidePropsContext,
  type NextApiHandler,
} from 'next';
import { type NextApiRequestCookies } from 'next/dist/server/api-utils/index.js';

import LogtoNextBaseClient from './client.js';
import { createSession } from './session.js';
import type { LogtoNextConfig } from './types.js';

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
} from '@slash-copilot/node';

export type {
  IdTokenClaims,
  LogtoContext,
  InteractionMode,
  LogtoErrorCode,
} from '@slash-copilot/node';

export default class LogtoClient extends LogtoNextBaseClient {
  constructor(config: LogtoNextConfig) {
    super(config, {
      NodeClient,
    });
  }

  handleSignIn =
    (
      redirectUri = `${this.config.baseUrl}/api/logto/sign-in-callback`,
      interactionMode?: InteractionMode
    ): NextApiHandler =>
      async (request, response) => {
        const nodeClient = await this.createNodeClientFromNextApi(request, response);
        await nodeClient.signIn(redirectUri, interactionMode);
        await this.storage?.save();

        if (this.navigateUrl) {
          response.redirect(this.navigateUrl);
        }
      };

  handleSignInCallback =
    (redirectTo = this.config.baseUrl): NextApiHandler =>
      async (request, response) => {
        const nodeClient = await this.createNodeClientFromNextApi(request, response);

        if (request.url) {
          await nodeClient.handleSignInCallback(`${this.config.baseUrl}${request.url}`);
          await this.storage?.save();
          response.redirect(redirectTo);
        }
      };

  handleSignOut =
    (redirectUri = this.config.baseUrl): NextApiHandler =>
      async (request, response) => {
        const nodeClient = await this.createNodeClientFromNextApi(request, response);
        await nodeClient.signOut(redirectUri);

        await this.storage?.destroy();
        await this.storage?.save();

        if (this.navigateUrl) {
          response.redirect(this.navigateUrl);
        }
      };

  handleUser = (configs?: GetContextParameters) =>
    this.withLogtoApiRoute((request, response) => {
      response.json(request.user);
    }, configs);

  handleAuthRoutes =
    (configs?: GetContextParameters): NextApiHandler =>
      (request, response) => {
        const { action } = request.query;

        if (action === 'sign-in') {
          return this.handleSignIn()(request, response);
        }

        if (action === 'sign-up') {
          return this.handleSignIn(undefined, 'signUp')(request, response);
        }

        if (action === 'sign-in-callback') {
          return this.handleSignInCallback()(request, response);
        }

        if (action === 'sign-out') {
          return this.handleSignOut()(request, response);
        }

        if (action === 'user') {
          return this.handleUser(configs)(request, response);
        }

        response.status(404).end();
      };

  withLogtoApiRoute =
    (handler: NextApiHandler, config: GetContextParameters = {}): NextApiHandler =>
      async (request, response) => {
        const nodeClient = await this.createNodeClientFromNextApi(request, response);
        const user = await nodeClient.getContext(config);

        // eslint-disable-next-line @silverhand/fp/no-mutating-methods
        Object.defineProperty(request, 'user', { enumerable: true, get: () => user });

        return handler(request, response);
      };

  withLogtoSsr =
    <P extends Record<string, unknown> = Record<string, unknown>>(
      handler: (
        context: GetServerSidePropsContext
      ) => GetServerSidePropsResult<P> | Promise<GetServerSidePropsResult<P>>,
      configs: GetContextParameters = {}
    ) =>
      async (context: GetServerSidePropsContext) => {
        const nodeClient = await this.createNodeClientFromNextApi(context.req, context.res);
        const user = await nodeClient.getContext(configs);

        // eslint-disable-next-line @silverhand/fp/no-mutating-methods
        Object.defineProperty(context.req, 'user', { enumerable: true, get: () => user });

        return handler(context);
      };

  async createNodeClientFromNextApi(
    request: IncomingMessage & {
      cookies: NextApiRequestCookies;
    },
    response: ServerResponse
  ): Promise<NodeClient> {
    const cookieName = `logto:${this.config.appId}`;

    return super.createNodeClient(
      await createSession(
        {
          secret: this.config.cookieSecret,
          crypto,
        },
        request.cookies[cookieName] ?? '',
        (value) => {
          const secure = this.config.cookieSecure;
          const maxAge = 14 * 3600 * 24;
          response.setHeader(
            'Set-Cookie',
            `${cookieName}=${value}; Path=/; Max-Age=${maxAge}; ${secure ? 'Secure; SameSite=None' : ''
            }`
          );
        }
      )
    );
  }
}
