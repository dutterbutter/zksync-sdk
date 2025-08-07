// bun scripts/abi-json-to-ts.ts path/to/*.json --out packages/core/src/abis
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, basename, extname, resolve } from 'node:path';

function toPascalCase(s: string) {
  return s
    .replace(extname(s), '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
if (outIdx === -1 || outIdx === args.length - 1) {
  console.error('Usage: bun scripts/abi-json-to-ts.ts <files...> --out <outDir>');
  process.exit(1);
}
const outDir = resolve(args[outIdx + 1]);
const files = args.slice(0, outIdx);

mkdirSync(outDir, { recursive: true });

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const parsed = JSON.parse(src);
  const abi = parsed.abi ?? parsed; // works with { abi: [...] } or raw [...]
  const name = toPascalCase(basename(f));
  const ts = `export const ${name}Abi = ${JSON.stringify(abi, null, 2)} as const;\nexport type ${name}Abi = typeof ${name}Abi;\n`;
  const outPath = resolve(outDir, `${name}.ts`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, ts, 'utf8');
  console.log('Wrote', outPath);
}
