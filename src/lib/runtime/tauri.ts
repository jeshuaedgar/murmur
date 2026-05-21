export const isTauriRuntime =
  typeof window !== "undefined" &&
  typeof (window as typeof window & { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__
    ?.invoke === "function";

export function requireTauri(feature: string) {
  if (isTauriRuntime) return;
  throw new Error(`${feature} requires Tauri runtime. Use 'npm run tauri dev'.`);
}
