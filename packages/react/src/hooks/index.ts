import type LogtoClient from '@slash-copilot/browser';
import { trySafe, type Optional } from '@silverhand/essentials';
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import { LogtoContext, throwContextError } from '../context.js';

type OptionalPromiseReturn<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => Promise<infer R>
  ? (...args: A) => Promise<Optional<R>>
  : T[K];
};

type Logto = {
  isAuthenticated: boolean;
  isLoading: boolean;
  error?: Error;
} & OptionalPromiseReturn<
  Pick<
    LogtoClient,
    | 'getRefreshToken'
    | 'getAccessToken'
    | 'getAccessTokenClaims'
    | 'getOrganizationToken'
    | 'getOrganizationTokenClaims'
    | 'getIdToken'
    | 'getIdTokenClaims'
    | 'signIn'
    | 'signOut'
    | 'fetchUserInfo'
  >
>;

const useLoadingState = () => {
  const { loadingCount, setLoadingCount } = useContext(LogtoContext);
  const isLoading = loadingCount > 0;

  const setLoadingState = useCallback(
    (state: boolean) => {
      if (state) {
        setLoadingCount((count) => count + 1);
      } else {
        setLoadingCount((count) => Math.max(0, count - 1));
      }
    },
    [setLoadingCount]
  );

  return { isLoading, setLoadingState };
};

const useErrorHandler = () => {
  const { setError } = useContext(LogtoContext);

  const handleError = useCallback(
    (error: unknown, fallbackErrorMessage?: string) => {
      if (error instanceof Error) {
        setError(error);
      } else if (fallbackErrorMessage) {
        setError(new Error(fallbackErrorMessage));
      }
      console.error(error);
    },
    [setError]
  );

  return { handleError };
};

const useHandleSignInCallback = (callback?: () => void) => {
  const { logtoClient, isAuthenticated, error, setIsAuthenticated } = useContext(LogtoContext);
  const { isLoading, setLoadingState } = useLoadingState();
  const { handleError } = useErrorHandler();
  const callbackRef = useRef<() => void>();

  useEffect(() => {
    // eslint-disable-next-line @silverhand/fp/no-mutation
    callbackRef.current = callback; // Update ref to the latest callback.
  }, [callback]);

  useEffect(() => {
    if (!logtoClient || isLoading || error) {
      return;
    }

    (async () => {
      const currentPageUrl = window.location.href;
      const isRedirected = await logtoClient.isSignInRedirected(currentPageUrl);

      if (!isAuthenticated && isRedirected) {
        setLoadingState(true);
        await trySafe(
          async () => {
            await logtoClient.handleSignInCallback(currentPageUrl);
            setIsAuthenticated(true);
            callbackRef.current?.();
          },
          (error) => {
            handleError(error, 'Unexpected error occurred while handling sign in callback.');
          }
        );
        setLoadingState(false);
      }
    })();
  }, [
    error,
    handleError,
    isAuthenticated,
    isLoading,
    logtoClient,
    setIsAuthenticated,
    setLoadingState,
  ]);

  return {
    isLoading,
    isAuthenticated,
    error,
  };
};

const useLogto = (): Logto => {
  const { logtoClient, loadingCount, isAuthenticated, error } = useContext(LogtoContext);
  const { setLoadingState } = useLoadingState();
  const { handleError } = useErrorHandler();

  const isLoading = loadingCount > 0;
  const client = logtoClient ?? throwContextError();

  const proxy = useCallback(
    <R, T extends unknown[]>(run: (...args: T) => Promise<R>, resetLoadingState = true) => {
      return async (...args: T): Promise<Optional<R>> => {
        try {
          setLoadingState(true);
          return await run(...args);
        } catch (error: unknown) {
          handleError(error, `Unexpected error occurred while calling ${run.name}.`);
        } finally {
          if (resetLoadingState) {
            setLoadingState(false);
          }
        }
      };
    },
    [setLoadingState, handleError]
  );

  const methods = useMemo(
    () => ({
      getRefreshToken: proxy(client.getRefreshToken.bind(client)),
      getAccessToken: proxy(client.getAccessToken.bind(client)),
      getAccessTokenClaims: proxy(client.getAccessTokenClaims.bind(client)),
      getOrganizationToken: proxy(client.getOrganizationToken.bind(client)),
      getOrganizationTokenClaims: proxy(client.getOrganizationTokenClaims.bind(client)),
      getIdToken: proxy(client.getIdToken.bind(client)),
      getIdTokenClaims: proxy(client.getIdTokenClaims.bind(client)),
      signIn: proxy(client.signIn.bind(client), false),
      // We deliberately do NOT set isAuthenticated to false in the function below, because the app state
      // may change immediately even before navigating to the oidc end session endpoint, which might cause
      // rendering problems.
      // Moreover, since the location will be redirected, the isAuthenticated state will not matter any more.
      signOut: proxy(client.signOut.bind(client)),
      fetchUserInfo: proxy(client.fetchUserInfo.bind(client)),
    }),
    [client, proxy]
  );

  return {
    isAuthenticated,
    isLoading,
    error,
    ...methods,
  };
};

export { useLogto, useHandleSignInCallback };
