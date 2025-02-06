import { getClientConfig } from "../config/client";
import { ApiPath, STORAGE_KEY, StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";
import {
  AppState,
  getLocalAppState,
  GetStoreState,
  mergeAppState,
  setLocalAppState,
} from "../utils/sync";
import { downloadAs, readFromFile } from "../utils";
import { showToast } from "../components/ui-lib";
import Locale from "../locales";
import { createSyncClient, ProviderType } from "../utils/cloud";
import { pbkdf2Sync } from "pbkdf2";
import aes from "aes-js";

export interface WebDavConfig {
  server: string;
  username: string;
  password: string;
}

const isApp = !!getClientConfig()?.isApp;
export type SyncStore = GetStoreState<typeof useSyncStore>;

const DEFAULT_ENCRYPT_STATE = {
  enabled: false,
  password: "",
  salt: "",
  iterations: 1,
  keylen: 256 / 8,
  digest: "sha512",
};
const DEFAULT_SYNC_STATE = {
  provider: ProviderType.WebDAV,
  useProxy: true,
  proxyUrl: ApiPath.Cors as string,

  webdav: {
    endpoint: "",
    username: "",
    password: "",
  },

  upstash: {
    endpoint: "",
    username: STORAGE_KEY,
    apiKey: "",
  },

  lastSyncTime: 0,
  lastProvider: "",

  encrypt: {
    ...DEFAULT_ENCRYPT_STATE,
  },
};

interface SerializeConfig {
  encrypt?: {
    password: string;
    salt: string;
    iterations: number;
    keylen: number;
    digest: string;
  };
}
function serialize<T = unknown>(data: T, config?: SerializeConfig) {
  const { encrypt } = config ?? {};
  let serializeData = JSON.stringify(data);

  if (encrypt) {
    const key = pbkdf2Sync(
      encrypt.password,
      encrypt.salt,
      encrypt.iterations,
      encrypt.keylen,
      encrypt.digest,
    ) as unknown as Uint8Array;
    const aesCtr = new aes.ModeOfOperation.ctr(key, new aes.Counter(5));
    const textBytes = aes.utils.utf8.toBytes(serializeData);
    const encryptedBytes = aesCtr.encrypt(textBytes);
    serializeData = aes.utils.hex.fromBytes(encryptedBytes);
  }

  return serializeData;
}
function unserialize<T = unknown>(data: string, config?: SerializeConfig): T {
  const { encrypt } = config ?? {};
  let serializeData = data;
  let isEncrypted = false;
  try {
    JSON.parse(serializeData);
  } catch (error) {
    isEncrypted = true;
  }

  if (encrypt && isEncrypted) {
    const encryptedBytes = aes.utils.hex.toBytes(serializeData);
    const key = pbkdf2Sync(
      encrypt.password,
      encrypt.salt,
      encrypt.iterations,
      encrypt.keylen,
      encrypt.digest,
    ) as unknown as Uint8Array;
    const aesCtr = new aes.ModeOfOperation.ctr(key, new aes.Counter(5));
    const decryptedBytes = aesCtr.decrypt(encryptedBytes);
    serializeData = aes.utils.utf8.fromBytes(decryptedBytes);
  }

  return JSON.parse(serializeData);
}

export const useSyncStore = createPersistStore(
  DEFAULT_SYNC_STATE,
  (set, get) => ({
    cloudSync() {
      const config = get()[get().provider];
      return Object.values(config).every((c) => c.toString().length > 0);
    },

    markSyncTime() {
      set({ lastSyncTime: Date.now(), lastProvider: get().provider });
    },

    export() {
      const state = getLocalAppState();
      const datePart = isApp
        ? `${new Date().toLocaleDateString().replace(/\//g, "_")} ${new Date()
            .toLocaleTimeString()
            .replace(/:/g, "_")}`
        : new Date().toLocaleString();

      const fileName = `Backup-${datePart}.json`;
      downloadAs(serialize(state), fileName);
    },

    async import() {
      const rawContent = await readFromFile();

      try {
        const remoteState = unserialize<AppState>(rawContent);
        const localState = getLocalAppState();
        mergeAppState(localState, remoteState);
        setLocalAppState(localState);
        location.reload();
      } catch (e) {
        console.error("[Import]", e);
        showToast(Locale.Settings.Sync.ImportFailed);
      }
    },

    getClient() {
      const provider = get().provider;
      const client = createSyncClient(provider, get());
      return client;
    },

    async sync() {
      const localState = getLocalAppState();
      const provider = get().provider;
      const config = get()[provider];
      const client = this.getClient();
      const encryptConfig = get().encrypt;

      try {
        const remoteState = await client.get(config.username);
        if (!remoteState || remoteState === "") {
          await client.set(
            config.username,
            serialize(localState, {
              encrypt: encryptConfig.enabled ? encryptConfig : undefined,
            }),
          );
          console.log(
            "[Sync] Remote state is empty, using local state instead.",
          );
          return;
        } else {
          const parsedRemoteState = unserialize<AppState>(
            await client.get(config.username),
            { encrypt: encryptConfig.enabled ? encryptConfig : undefined },
          );
          mergeAppState(localState, parsedRemoteState);
          setLocalAppState(localState);
        }
      } catch (e) {
        console.log("[Sync] failed to get remote state", e);
        throw e;
      }

      await client.set(
        config.username,
        serialize(localState, {
          encrypt: encryptConfig.enabled ? encryptConfig : undefined,
        }),
      );

      this.markSyncTime();
    },

    async check() {
      const client = this.getClient();
      return await client.check();
    },
  }),
  {
    name: StoreKey.Sync,
    version: 1.3,

    migrate(persistedState, version) {
      const newState = persistedState as typeof DEFAULT_SYNC_STATE;

      if (version < 1.1) {
        newState.upstash.username = STORAGE_KEY;
      }

      if (version < 1.2) {
        if (
          (persistedState as typeof DEFAULT_SYNC_STATE).proxyUrl ===
          "/api/cors/"
        ) {
          newState.proxyUrl = "";
        }
      }

      if (version < 1.3) {
        newState.encrypt = {
          ...DEFAULT_ENCRYPT_STATE,
          ...(newState.encrypt ?? {}),
        };
      }

      return newState as any;
    },
  },
);
