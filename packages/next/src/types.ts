import type { LogtoConfig, PersistKey } from '@slash-copilot/node';
import type NodeClient from '@slash-copilot/node';

export type SessionData = {
  [PersistKey.AccessToken]?: string;
  [PersistKey.IdToken]?: string;
  [PersistKey.SignInSession]?: string;
  [PersistKey.RefreshToken]?: string;
};

export type Session = SessionData & {
  save: () => Promise<void>;
  getValues?: () => Promise<string>;
};

export type LogtoNextConfig = LogtoConfig & {
  cookieSecret: string;
  cookieSecure: boolean;
  baseUrl: string;
};

export type Adapters = {
  NodeClient: typeof NodeClient;
};
