// Builds lib/generated/reader-asm.js: the recipe reader's WebAssembly translated to
// plain JavaScript with Binaryen's wasm2js. Only the Safari build ships it, as a
// fallback: Safari 18 refuses to compile WebAssembly in an extension page even with
// 'wasm-unsafe-eval' in the policy (https://bugs.webkit.org/show_bug.cgi?id=290153).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasm = require.resolve("@cooklang/cooklang-import/cooklang_import_bg.wasm");
const wasm2js = join(dirname(require.resolve("binaryen/package.json")), "bin", "wasm2js");
const out = join(root, "lib", "generated", "reader-asm.js");

mkdirSync(dirname(out), { recursive: true });
execFileSync(
  process.execPath,
  [
    wasm2js,
    wasm,
    "-O",
    "--enable-bulk-memory",
    "--enable-nontrapping-float-to-int",
    "--enable-sign-ext",
    "--enable-mutable-globals",
    "--enable-reference-types",
    "--enable-multivalue",
    "-o",
    out,
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);

// wasm2js grows memory by allocating a new buffer and leaves the old one usable.
// Real WebAssembly detaches it, and the package's glue relies on that to notice its
// cached view went stale. Detach the old buffer the same way.
function replaceOnce(source, find, replacement) {
  if (source.split(find).length !== 2) throw new Error(`make-js-reader: expected exactly one "${find}" in the wasm2js output`);
  return source.replace(find, replacement);
}
let source = readFileSync(out, "utf8");
source = replaceOnce(source, "newHEAP8.set(HEAP8);", "var oldBuffer = HEAP8.buffer;\n   newHEAP8.set(HEAP8);");
source = replaceOnce(source, "buffer = newBuffer;", "buffer = newBuffer;\n   structuredClone(oldBuffer, { transfer: [oldBuffer] });");
writeFileSync(out, source);
