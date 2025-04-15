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
    // 使用固定长度的块进行加密，确保每个字符都被完整处理
    const textBytes = new TextEncoder().encode(serializeData);
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
    // 使用 TextDecoder 确保 UTF-8 字符（包括表情符号）被正确解码
    serializeData = new TextDecoder("utf-8").decode(decryptedBytes);
  }

  return JSON.parse(serializeData);
}

// 计算字符串的哈希值
async function calculateHash(data: string) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);

  // 将哈希值转换为十六进制字符串
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
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

    async _upload(key: string, data: string) {
      const client = this.getClient();

      // 计算本地数据的哈希
      const localDataHash = await calculateHash(data);

      // 执行上传操作
      await client.set(key, data);

      // 上传后验证数据一致性
      // 获取刚上传的远程数据
      const remoteData = await client.get(key);
      // 计算远程数据的哈希
      const remoteDataHash = await calculateHash(remoteData);

      // 比较哈希，验证上传是否成功
      if (localDataHash === remoteDataHash) {
        console.log("[Sync] 数据上传成功，哈希验证一致");
      } else {
        throw new Error("[Sync] 数据上传可能存在异常，哈希不一致");
      }
    },

    async sync() {
      const localState = getLocalAppState();
      const provider = get().provider;
      const config = get()[provider];
      const client = this.getClient();
      const encryptConfig = get().encrypt;

      const serializedData = serialize(localState, {
        encrypt: encryptConfig.enabled ? encryptConfig : undefined,
      });
      try {
        const remoteState = await client.get(config.username);
        if (!remoteState || remoteState === "") {
          await this._upload(config.username, serializedData);
          console.log(
            "[Sync] Remote state is empty, using local state instead.",
          );
          return;
        } else {
          const parsedRemoteState = unserialize<AppState>(remoteState, {
            encrypt: encryptConfig.enabled ? encryptConfig : undefined,
          });
          mergeAppState(localState, parsedRemoteState);
          setLocalAppState(localState);
        }
      } catch (e) {
        console.log("[Sync] failed to get remote state", e);
        throw e;
      }

      await this._upload(config.username, serializedData);

      this.markSyncTime();
    },

    async overrideRemote() {
      const localState = getLocalAppState();
      const provider = get().provider;
      const config = get()[provider];
      const encryptConfig = get().encrypt;

      await this._upload(
        config.username,
        serialize(localState, {
          encrypt: encryptConfig.enabled ? encryptConfig : undefined,
        }),
      );

      this.markSyncTime();
    },

    async overrideLocal() {
      const provider = get().provider;
      const config = get()[provider];
      const client = this.getClient();
      const encryptConfig = get().encrypt;

      try {
        const remoteState = await client.get(config.username);
        if (!remoteState || remoteState === "") {
          console.log(
            "[Sync] Remote state is empty, using local state instead.",
          );
          return;
        } else {
          const parsedRemoteState = unserialize<AppState>(remoteState, {
            encrypt: encryptConfig.enabled ? encryptConfig : undefined,
          });
          setLocalAppState(parsedRemoteState);
        }
      } catch (e) {
        console.log("[Sync] failed to get remote state", e);
        throw e;
      }

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
