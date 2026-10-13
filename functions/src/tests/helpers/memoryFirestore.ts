/** Transaction fixture serializes commits like Firestore; no network or SDK state. */
export function memoryFirestore() {
  const documents = new Map<string, any>();
  let queue = Promise.resolve();
  const deleted = "__deleted_field__";
  function merge(previous: any, update: any): any {
    const result = { ...previous };
    for (const [key, value] of Object.entries(update)) {
      if (value === deleted) delete result[key];
      else result[key] = value && typeof value === "object" && !Array.isArray(value) && !(value as any).toMillis
        ? merge(result[key] ?? {}, value) : value;
    }
    return result;
  }
  const snapshot = (path: string) => ({ exists: documents.has(path), data: () => documents.get(path) });
  const doc = (path: string) => ({ path,
    get: async () => snapshot(path),
    set: async (value: any, options?: any) => { documents.set(path, options?.merge ? merge(documents.get(path) ?? {}, value) : value); },
  });
  const runTransaction = jest.fn((fn: any) => {
    const result = queue.then(async () => {
      const writes: Array<() => Promise<void>> = [];
      const result = await fn({ get: async (ref: any) => snapshot(ref.path),
        set: (ref: any, value: any, options?: any) => { writes.push(() => ref.set(value, options)); } });
      for (const write of writes) await write();
      return result;
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  });
  return { documents, deleted, doc, runTransaction,
    collection: (name: string) => ({ doc: (id: string) => doc(`${name}/${id}`), add: jest.fn() }),
    timestamp: (ms: number) => ({ toMillis: () => ms }),
  };
}
