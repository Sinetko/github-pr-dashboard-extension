import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

type Kind = 'component' | 'hook' | 'store';

const toPascalCase = (kebab: string): string =>
  kebab
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
const toCamelCase = (kebab: string): string => {
  const pascal = toPascalCase(kebab);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

const templates = (kind: Kind, name: string): Record<string, string> => {
  const pascal = toPascalCase(name);
  const camel = toCamelCase(name);
  switch (kind) {
    case 'component':
      return {
        [`${name}.component.tsx`]: `import type { ${pascal}Props } from './${name}.types';\nimport type { FC } from 'react';\n\nimport { ${pascal}Root } from './${name}.styles';\n\nexport const ${pascal}: FC<${pascal}Props> = ({ children }) => <${pascal}Root>{children}</${pascal}Root>;\n`,
        [`${name}.styles.ts`]: `import styled from 'styled-components';\n\nexport const ${pascal}Root = styled.div\`\`;\n`,
        [`${name}.types.ts`]: `import type { ReactNode } from 'react';\n\nexport interface ${pascal}Props {\n  children?: ReactNode;\n}\n`,
        'index.ts': `export { ${pascal} } from './${name}.component';\nexport type { ${pascal}Props } from './${name}.types';\n`,
      };
    case 'hook':
      return {
        [`${name}.hook.ts`]: `import type { ${pascal}Result } from './${name}.types';\n\nexport const ${camel} = (): ${pascal}Result => ({});\n`,
        [`${name}.types.ts`]: `export type ${pascal}Result = Record<string, never>;\n`,
        'index.ts': `export { ${camel} } from './${name}.hook';\nexport type { ${pascal}Result } from './${name}.types';\n`,
      };
    case 'store':
      return {
        [`${name}.store.ts`]: `import { create } from 'zustand';\n\nimport type { ${pascal}State } from './${name}.types';\n\nexport const use${pascal} = create<${pascal}State>()(() => ({}));\n`,
        [`${name}.types.ts`]: `export type ${pascal}State = Record<string, never>;\n`,
        'index.ts': `export { use${pascal} } from './${name}.store';\nexport type { ${pascal}State } from './${name}.types';\n`,
      };
  }
};

const [kindArgument, targetArgument] = process.argv.slice(2);
const KINDS: readonly string[] = ['component', 'hook', 'store'];
if (kindArgument === undefined || !KINDS.includes(kindArgument) || targetArgument === undefined) {
  console.error('Usage: pnpm generate <component|hook|store> <path/to/kebab-name>');
  process.exit(1);
}
const directory = resolve(targetArgument);
const name = basename(directory);
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
  console.error(`"${name}" must be kebab-case`);
  process.exit(1);
}
if (existsSync(directory)) {
  console.error(`${directory} already exists`);
  process.exit(1);
}
mkdirSync(directory, { recursive: true });
for (const [fileName, content] of Object.entries(templates(kindArgument as Kind, name))) {
  writeFileSync(join(directory, fileName), content);
  console.log(`created ${join(targetArgument, fileName)}`);
}
execFileSync('pnpm', ['exec', 'eslint', '--fix', directory], { stdio: 'inherit' });
execFileSync('pnpm', ['exec', 'prettier', '--write', directory], { stdio: 'ignore' });
