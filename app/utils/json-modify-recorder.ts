import { cloneDeep, get, isArray, isEqual, set, unset } from "lodash-es";

type TimestampEntry = {
  timestamp: number;
  deleted: boolean;
};
type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

function isPrimitive(value: any): value is JsonPrimitive {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  );
}

type Change = Map<
  string,
  {
    type: "update" | "delete";
    value?: JsonValue;
  }
>;

export class JSONModifyRecorder<T extends JsonValue = JsonValue> {
  private currentValue: JsonValue;
  private timestamps: Map<string, TimestampEntry>;

  constructor(value: T) {
    this.timestamps = new Map();
    this.currentValue = cloneDeep(value);
    this.cleanupParents(this.currentValue);
  }

  _update(newValue: JsonValue, changes: Change): void {
    const now = Date.now();

    changes.forEach((change, path) => {
      if (change.type === "delete") {
        this.timestamps.set(path, { timestamp: now, deleted: true });
        this.deleteValueAtPath(path);
      } else {
        this.timestamps.set(path, { timestamp: now, deleted: false });
        this.setValueAtPath(path, change.value);
      }
    });

    this.cleanupParents(newValue);
  }

  update(newValue: JsonValue): void {
    const changes = this.diff(this.currentValue, newValue);
    this._update(newValue, changes);
  }

  private diff(
    oldVal: JsonValue | undefined,
    newVal: JsonValue | undefined,
    path: string = "",
    changes: Change = new Map(),
  ): Change {
    if (isEqual(oldVal, newVal)) return changes;

    changes.set(path, { type: "update", value: newVal });

    if (
      typeof oldVal !== "object" ||
      oldVal === null ||
      typeof newVal !== "object" ||
      newVal === null
    ) {
      return changes;
    }

    const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
    allKeys.forEach((key) => {
      const currentPath = path ? `${path}.${key}` : key;
      const oldItem = this.getObjValue(oldVal, key);
      const newItem = this.getObjValue(newVal, key);

      if (!(key in newVal)) {
        changes.set(currentPath, { type: "delete" });
      } else if (!(key in oldVal)) {
        changes.set(currentPath, { type: "update", value: newItem });
        this.diff({}, newItem, currentPath, changes);
      } else {
        if (!isEqual(oldItem, newItem)) {
          this.diff(oldItem, newItem, currentPath, changes);
        }
      }
    });

    return changes;
  }

  private getObjValue(
    obj: JsonObject | JsonArray,
    key: string,
  ): JsonValue | undefined {
    if (Array.isArray(obj)) {
      const index = parseInt(key, 10);
      if (isNaN(index) || index < 0 || index >= obj.length) return undefined;
      return obj[index];
    } else {
      return obj[key];
    }
  }

  private setValueAtPath(path: string, value: JsonValue | undefined): void {
    const { currentValue } = this;
    if (currentValue && !isPrimitive(currentValue)) {
      set(currentValue, path, cloneDeep(value));
    } else if (isPrimitive(currentValue) && path.length === 0) {
      this.currentValue = value!;
    } else {
      throw new Error(`Cannot set value at path ${path} on a primitive value`);
    }
  }

  private deleteValueAtPath(path: string): void {
    unset(this.currentValue, path);
  }

  private getValueAtPath(path: string): JsonValue {
    const { currentValue } = this;
    if (isPrimitive(currentValue)) {
      if (path.length === 0) {
        return currentValue;
      } else {
        throw new Error(
          `Cannot get value at path ${path} on a primitive value`,
        );
      }
    }
    return cloneDeep(get(currentValue, path));
  }

  private cleanupParents(newValue: JsonValue): void {
    // Ensure parent paths exist in timestamps
    const now = Date.now();
    const traverse = (value: JsonValue, path: string) => {
      if (isPrimitive(value)) {
        this.timestamps.set("", {
          timestamp: now,
          deleted: false,
        });
      } else if (isArray(value)) {
        value.forEach((item, index) => {
          const currentPath = `${path}[${index}]`;
          traverse(item, currentPath);
        });
      } else {
        for (const key in value) {
          const currentPath = path ? `${path}.${key}` : key;
          if (!this.timestamps.has(currentPath)) {
            this.timestamps.set(currentPath, {
              timestamp: now,
              deleted: false,
            });
          }
          if (typeof value[key] === "object" && value[key] !== null) {
            traverse(value[key], currentPath);
          }
        }
      }
    };
    traverse(newValue, "");
  }

  merge(other: JSONModifyRecorder): void {
    other.timestamps.forEach((otherEntry, path) => {
      const currentEntry = this.timestamps.get(path);
      if (!currentEntry || otherEntry.timestamp > currentEntry.timestamp) {
        this.timestamps.set(path, { ...otherEntry });
        if (otherEntry.deleted) {
          this.deleteValueAtPath(path);
        } else {
          const value = other.getValueAtPath(path);
          this.setValueAtPath(path, value);
        }
      }
    });
  }

  serialize(): string {
    const data = {
      value: this.currentValue,
      timestamps: Array.from(this.timestamps.entries()).reduce(
        (obj, [key, entry]) => {
          obj[key] = entry;
          return obj;
        },
        {} as Record<string, TimestampEntry>,
      ),
    };
    return JSON.stringify(data);
  }

  static deserialize(serialized: string): JSONModifyRecorder {
    const data = JSON.parse(serialized);
    const instance = new JSONModifyRecorder(data.value);
    instance.timestamps = new Map(
      Object.entries(data.timestamps) as [string, TimestampEntry][],
    );
    return instance;
  }

  getTimestampEntry(keyPath: string): TimestampEntry | undefined {
    return this.timestamps.get(keyPath);
  }

  // 保持测试用方法
  getTimestamp(keyPath: string): number | undefined {
    return this.getTimestampEntry(keyPath)?.timestamp;
  }

  getValue(): T {
    return cloneDeep(this.currentValue!) as T;
  }
}
