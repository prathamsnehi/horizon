/** Bound best-effort coordination without delaying a completed response indefinitely. */
export async function withinTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("operation_timeout")), Math.max(1, milliseconds));
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
