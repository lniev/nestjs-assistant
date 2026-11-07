// Upgrade every playground module's default project to the shape a real NestJS
// CLI scaffold produces:
//   - src/main.ts boots the app (NestFactory.create -> configure -> listen)
//   - src/bootstrap.ts (the previous playground-only hook) is removed
//   - realistic root files: package.json, tsconfig.json, tsconfig.build.json,
//     nest-cli.json, .gitignore, .prettierrc, eslint.config.mjs, README.md
//
// Safe to re-run: src/main.ts is regenerated from the current bootstrap.ts when
// one exists (otherwise created from the standard template) and root files are
// rewritten deterministically.
//
// Usage: node scripts/upgrade-module-scaffold.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULES_DIR = path.join(ROOT, 'playground-modules');
const TEMPLATE_DIR = path.join(ROOT, 'host', 'playground-template');
const dryRun = process.argv.includes('--dry');

/** Standard package.json for a Nest CLI scaffold project. */
const PACKAGE_JSON = `{
  "name": "nest-playground",
  "version": "0.0.1",
  "description": "NestJS playground project",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \\"src/**/*.ts\\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \\"{src,apps,libs,test}/**/*.ts\\" --fix"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.7",
    "prettier": "^3.4.2",
    "typescript": "^5.7.3"
  }
}
`;

/** Standard tsconfig.json (matches what `nest new` generates, with strict off). */
const TSCONFIG_JSON = `{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": false,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": false
  }
}
`;

const TSCONFIG_BUILD_JSON = `{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
`;

const NEST_CLI_JSON = `{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
`;

const GITIGNORE = `# compiled output
/dist
/node_modules
/build

# logs
logs
*.log
npm-debug.log*
pnpm-debug.log*

# OS
.DS_Store

# env
.env
.env.*
`;

const PRETTIER_RC = `{
  "singleQuote": true,
  "trailingComma": "all"
}
`;

const ESLINT_CONFIG = `// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['eslint.config.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      sourceType: 'commonjs',
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  eslintPluginPrettierRecommended,
);
`;

/** Standard README for one module. */
function moduleReadme(manifest) {
	const title = manifest.titleZh || manifest.id;
	const summary = typeof manifest.summary === 'string' && manifest.summary.trim() !== '' ? manifest.summary.trim() : '';
	const practice = typeof manifest.practice === 'string' && manifest.practice.trim() !== '' ? manifest.practice.trim() : '';
	const routes = Array.isArray(manifest.routes)
		? manifest.routes.map((route) => '- `' + String(route.method || 'GET').toUpperCase() + ' ' + String(route.path) + '`').join('\n')
		: '';
	return `# ${title}

${summary}

${practice !== '' ? '## 练习\n\n' + practice + '\n\n' : ''}## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

\`\`\`bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
\`\`\`

${routes !== '' ? '## 默认路由\n\n' + routes + '\n' : ''}`;
}

/** Real Nest CLI-style src/main.ts without module-specific global config. */
function plainMain() {
	return `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
`;
}

/** Split one TS source into its import section and the rest. */
function splitImports(source) {
	const lines = source.split('\n');
	const imports = [];
	const kept = [];
	let index = 0;
	while (index < lines.length) {
		const line = lines[index];
		if (/^\s*import\b/.test(line)) {
			let statement = line;
			while (index + 1 < lines.length && !/;\s*$/.test(statement)) {
				index += 1;
				statement += '\n' + lines[index];
			}
			imports.push(statement);
			index += 1;
			continue;
		}
		kept.push(line);
		index += 1;
	}
	return { imports, rest: kept.join('\n') };
}

/** Extract the body of `configureApp(app)` from a bootstrap.ts source. */
function configureAppBody(source) {
	const signature = /export\s+async\s+function\s+configureApp\s*\(\s*app\s*:\s*INestApplication\s*\)\s*:\s*Promise<void>\s*\{/.exec(source);
	if (signature === null) return null;
	const bodyStart = source.indexOf('{', signature.index + signature[0].length - 1) + 1;
	let depth = 1;
	let index = bodyStart;
	while (index < source.length && depth > 0) {
		const character = source[index];
		if (character === '{') depth += 1;
		else if (character === '}') depth -= 1;
		index += 1;
	}
	if (depth !== 0) return null;
	const body = source.slice(bodyStart, index - 1);
	return body.replace(/^\n+/, '').replace(/\s+$/, '');
}

/** Generate src/main.ts from the old bootstrap.ts (or the plain template). */
function convertedMain(bootstrapSource) {
	const { imports } = splitImports(bootstrapSource);
	const extraImports = imports
		.filter((statement) => !/INestApplication/.test(statement))
		.map((statement) => statement.trim())
		.filter((statement) => statement !== '');
	const body = configureAppBody(bootstrapSource);
	const bodyLines = body === null ? [] : body.split('\n');
	const configured = bodyLines.map((line) => (line.trim() === '' ? '' : line)).join('\n');
	return `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
${extraImports.length > 0 ? extraImports.join('\n') + '\n' : ''}
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
${configured !== '' ? configured + '\n' : ''}  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
`;
}

function walk(dir, acc) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === 'dist') continue;
		const absolute = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(absolute, acc);
		else acc.push(absolute);
	}
	return acc;
}

let converted = 0;
let created = 0;

for (const entry of fs.readdirSync(MODULES_DIR, { withFileTypes: true })) {
	if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
	const moduleDir = path.join(MODULES_DIR, entry.name);
	const manifestPath = path.join(moduleDir, 'module.json');
	if (!fs.existsSync(manifestPath)) continue;
	const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	const defaultDir = path.join(moduleDir, 'default');
	const srcDir = path.join(defaultDir, 'src');
	const bootstrapPath = path.join(srcDir, 'bootstrap.ts');
	const mainPath = path.join(srcDir, 'main.ts');
	if (fs.existsSync(bootstrapPath)) {
		const mainSource = convertedMain(fs.readFileSync(bootstrapPath, 'utf8'));
		if (!dryRun) {
			fs.writeFileSync(mainPath, mainSource, 'utf8');
			fs.rmSync(bootstrapPath, { force: true });
		}
		converted += 1;
	} else if (!fs.existsSync(mainPath)) {
		if (!dryRun) fs.writeFileSync(mainPath, plainMain(), 'utf8');
		created += 1;
	}
	/* Root scaffold files. */
	const rootFiles = {
		'package.json': PACKAGE_JSON,
		'tsconfig.json': TSCONFIG_JSON,
		'tsconfig.build.json': TSCONFIG_BUILD_JSON,
		'nest-cli.json': NEST_CLI_JSON,
		'.gitignore': GITIGNORE,
		'.prettierrc': PRETTIER_RC,
		'eslint.config.mjs': ESLINT_CONFIG,
		'README.md': moduleReadme(manifest)
	};
	for (const name of Object.keys(rootFiles)) {
		if (!dryRun) fs.writeFileSync(path.join(defaultDir, name), rootFiles[name], 'utf8');
	}
	/* defaultFile should point at a real file. */
	if (!dryRun) {
		const defaultFile = manifest.defaultFile === 'src/bootstrap.ts' || manifest.defaultFile === undefined || manifest.defaultFile === ''
			? 'src/main.ts'
			: manifest.defaultFile;
		if (defaultFile !== manifest.defaultFile) {
			manifest.defaultFile = defaultFile;
			fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
		}
	}
}

/* The free-form sandbox template doubles as runtime reset source. */
(function upgradeTemplate() {
	const srcDir = path.join(TEMPLATE_DIR, 'src');
	const bootstrapPath = path.join(srcDir, 'bootstrap.ts');
	const mainPath = path.join(srcDir, 'main.ts');
	if (fs.existsSync(bootstrapPath)) {
		const mainSource = convertedMain(fs.readFileSync(bootstrapPath, 'utf8'));
		if (!dryRun) {
			fs.writeFileSync(mainPath, mainSource, 'utf8');
			fs.rmSync(bootstrapPath, { force: true });
		}
		converted += 1;
	} else if (!fs.existsSync(mainPath) && !dryRun) {
		fs.writeFileSync(mainPath, plainMain(), 'utf8');
		created += 1;
	}
	for (const [name, content] of Object.entries({
		'package.json': PACKAGE_JSON,
		'tsconfig.json': TSCONFIG_JSON,
		'tsconfig.build.json': TSCONFIG_BUILD_JSON,
		'nest-cli.json': NEST_CLI_JSON,
		'.gitignore': GITIGNORE,
		'.prettierrc': PRETTIER_RC
	})) {
		if (!dryRun) fs.writeFileSync(path.join(TEMPLATE_DIR, name), content, 'utf8');
	}
})();

console.log('module scaffold upgraded: ' + String(converted) + ' main.ts converted, ' + String(created) + ' main.ts created' + (dryRun ? ' (dry run)' : ''));
if (!dryRun) console.log('template upgraded: ' + TEMPLATE_DIR);
if (!dryRun) console.log('next: node scripts/verify-modules.mjs');
