import { initSync } from "@cooklang/cooklang-import";

/**
 * Start the recipe reader from its plain-JavaScript translation instead of the
 * WebAssembly file, for Safari 18, which refuses to compile WebAssembly in an
 * extension page (https://bugs.webkit.org/show_bug.cgi?id=290153).
 *
 * The package's loader only knows how to instantiate WebAssembly, so for the length
 * of one synchronous call the two constructors it uses are swapped for stand-ins
 * that hand it the translated module's exports.
 */
export async function startJsReader(): Promise<void> {
  const exports = await import("./generated/reader-asm.js");
  const globals = WebAssembly as unknown as Record<string, unknown>;
  const saved = { Module: globals.Module, Instance: globals.Instance };
  const StandInModule = function () {} as unknown as new () => WebAssembly.Module;
  globals.Module = StandInModule;
  globals.Instance = function () {
    return { exports };
  };
  try {
    initSync({ module: new StandInModule() });
  } finally {
    Object.assign(globals, saved);
  }
}
