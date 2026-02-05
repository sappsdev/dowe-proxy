import { compareUUID } from "../utils/uuid";

interface IndexNode<T> {
  keys: Uint8Array[];
  values: T[];
  children: IndexNode<T>[] | null;
}

const DEFAULT_ORDER = 64;

export class BTreeIndex<T> {
  private root: IndexNode<T>;
  private order: number;
  private size: number;

  constructor(order: number = DEFAULT_ORDER) {
    this.order = order;
    this.root = this.createNode();
    this.size = 0;
  }

  private createNode(): IndexNode<T> {
    return {
      keys: [],
      values: [],
      children: null,
    };
  }

  getSize(): number {
    return this.size;
  }

  get(key: Uint8Array): T | undefined {
    return this.searchNode(this.root, key);
  }

  private searchNode(node: IndexNode<T>, key: Uint8Array): T | undefined {
    let i = 0;
    while (i < node.keys.length) {
      const nodeKey = node.keys[i];
      if (nodeKey === undefined || compareUUID(key, nodeKey) <= 0) break;
      i++;
    }

    const currentKey = node.keys[i];
    if (
      i < node.keys.length &&
      currentKey !== undefined &&
      compareUUID(key, currentKey) === 0
    ) {
      return node.values[i];
    }

    if (node.children === null) {
      return undefined;
    }

    const child = node.children[i];
    if (child === undefined) {
      return undefined;
    }

    return this.searchNode(child, key);
  }

  set(key: Uint8Array, value: T): void {
    const result = this.insertNode(this.root, key, value);

    if (result !== null) {
      const newRoot = this.createNode();
      newRoot.keys = [result.key];
      newRoot.values = [result.value];
      newRoot.children = [this.root, result.right];
      this.root = newRoot;
    }

    this.size++;
  }

  private insertNode(
    node: IndexNode<T>,
    key: Uint8Array,
    value: T,
  ): { key: Uint8Array; value: T; right: IndexNode<T> } | null {
    let i = 0;
    while (i < node.keys.length) {
      const nodeKey = node.keys[i];
      if (nodeKey === undefined || compareUUID(key, nodeKey) <= 0) break;
      i++;
    }

    const currentKey = node.keys[i];
    if (
      i < node.keys.length &&
      currentKey !== undefined &&
      compareUUID(key, currentKey) === 0
    ) {
      node.values[i] = value;
      this.size--;
      return null;
    }

    if (node.children === null) {
      node.keys.splice(i, 0, key);
      node.values.splice(i, 0, value);

      if (node.keys.length >= this.order) {
        return this.splitLeaf(node);
      }

      return null;
    }

    const child = node.children[i];
    if (child === undefined) {
      return null;
    }

    const result = this.insertNode(child, key, value);

    if (result === null) {
      return null;
    }

    node.keys.splice(i, 0, result.key);
    node.values.splice(i, 0, result.value);
    node.children.splice(i + 1, 0, result.right);

    if (node.keys.length >= this.order) {
      return this.splitInternal(node);
    }

    return null;
  }

  private splitLeaf(node: IndexNode<T>): {
    key: Uint8Array;
    value: T;
    right: IndexNode<T>;
  } {
    const mid = Math.floor(node.keys.length / 2);

    const right = this.createNode();
    right.keys = node.keys.splice(mid);
    right.values = node.values.splice(mid);

    const firstKey = right.keys[0];
    const firstValue = right.values[0];

    if (firstKey === undefined || firstValue === undefined) {
      throw new Error("Split produced empty node");
    }

    return {
      key: firstKey,
      value: firstValue,
      right,
    };
  }

  private splitInternal(node: IndexNode<T>): {
    key: Uint8Array;
    value: T;
    right: IndexNode<T>;
  } {
    const mid = Math.floor(node.keys.length / 2);

    const promoteKey = node.keys[mid];
    const promoteValue = node.values[mid];

    if (promoteKey === undefined || promoteValue === undefined) {
      throw new Error("Split produced empty node");
    }

    const right = this.createNode();
    right.keys = node.keys.splice(mid + 1);
    right.values = node.values.splice(mid + 1);
    right.children = node.children!.splice(mid + 1);

    node.keys.pop();
    node.values.pop();

    return {
      key: promoteKey,
      value: promoteValue,
      right,
    };
  }

  delete(key: Uint8Array): boolean {
    const found = this.deleteNode(this.root, key);

    if (found && this.root.keys.length === 0 && this.root.children !== null) {
      const firstChild = this.root.children[0];
      if (firstChild !== undefined) {
        this.root = firstChild;
      }
    }

    if (found) {
      this.size--;
    }

    return found;
  }

  private deleteNode(node: IndexNode<T>, key: Uint8Array): boolean {
    let i = 0;
    while (i < node.keys.length) {
      const nodeKey = node.keys[i];
      if (nodeKey === undefined || compareUUID(key, nodeKey) <= 0) break;
      i++;
    }

    if (node.children === null) {
      const currentKey = node.keys[i];
      if (
        i < node.keys.length &&
        currentKey !== undefined &&
        compareUUID(key, currentKey) === 0
      ) {
        node.keys.splice(i, 1);
        node.values.splice(i, 1);
        return true;
      }
      return false;
    }

    const currentKey = node.keys[i];
    if (
      i < node.keys.length &&
      currentKey !== undefined &&
      compareUUID(key, currentKey) === 0
    ) {
      const child = node.children[i];
      if (child === undefined) {
        return false;
      }
      const predecessor = this.findMax(child);
      node.keys[i] = predecessor.key;
      node.values[i] = predecessor.value;
      return this.deleteNode(child, predecessor.key);
    }

    const child = node.children[i];
    if (child === undefined) {
      return false;
    }
    return this.deleteNode(child, key);
  }

  private findMax(node: IndexNode<T>): { key: Uint8Array; value: T } {
    if (node.children === null) {
      const lastIdx = node.keys.length - 1;
      const lastKey = node.keys[lastIdx];
      const lastValue = node.values[lastIdx];

      if (lastKey === undefined || lastValue === undefined) {
        throw new Error("Empty node in findMax");
      }

      return {
        key: lastKey,
        value: lastValue,
      };
    }

    const lastChild = node.children[node.children.length - 1];
    if (lastChild === undefined) {
      throw new Error("Empty children array");
    }

    return this.findMax(lastChild);
  }

  *entries(): Generator<[Uint8Array, T]> {
    yield* this.iterateNode(this.root);
  }

  private *iterateNode(node: IndexNode<T>): Generator<[Uint8Array, T]> {
    for (let i = 0; i < node.keys.length; i++) {
      if (node.children !== null) {
        const child = node.children[i];
        if (child !== undefined) {
          yield* this.iterateNode(child);
        }
      }
      const key = node.keys[i];
      const value = node.values[i];
      if (key !== undefined && value !== undefined) {
        yield [key, value];
      }
    }

    if (node.children !== null && node.children.length > node.keys.length) {
      const lastChild = node.children[node.children.length - 1];
      if (lastChild !== undefined) {
        yield* this.iterateNode(lastChild);
      }
    }
  }

  clear(): void {
    this.root = this.createNode();
    this.size = 0;
  }
}

export interface RecordLocation {
  offset: bigint;
  size: number;
  checksum: number;
}

export class IndexManager {
  private primary: BTreeIndex<RecordLocation>;
  private secondary: Map<string, BTreeIndex<Uint8Array[]>>;

  constructor() {
    this.primary = new BTreeIndex<RecordLocation>();
    this.secondary = new Map();
  }

  getPrimaryIndex(): BTreeIndex<RecordLocation> {
    return this.primary;
  }

  getSecondaryIndex(name: string): BTreeIndex<Uint8Array[]> | undefined {
    return this.secondary.get(name);
  }

  createSecondaryIndex(name: string): BTreeIndex<Uint8Array[]> {
    const index = new BTreeIndex<Uint8Array[]>();
    this.secondary.set(name, index);
    return index;
  }

  dropSecondaryIndex(name: string): boolean {
    return this.secondary.delete(name);
  }

  getRecord(id: Uint8Array): RecordLocation | undefined {
    return this.primary.get(id);
  }

  setRecord(id: Uint8Array, location: RecordLocation): void {
    this.primary.set(id, location);
  }

  deleteRecord(id: Uint8Array): boolean {
    return this.primary.delete(id);
  }

  getSize(): number {
    return this.primary.getSize();
  }

  clear(): void {
    this.primary.clear();
    this.secondary.clear();
  }

  *entries(): Generator<[Uint8Array, RecordLocation]> {
    yield* this.primary.entries();
  }
}
