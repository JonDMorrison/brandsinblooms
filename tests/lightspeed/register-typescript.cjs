/* Native Node contract runner. Uses the repository's pinned TypeScript dependency. */
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
      esModuleInterop: true, isolatedModules: true },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};
