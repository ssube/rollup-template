import { join, sep } from 'path';
import commonjs from '@rollup/plugin-commonjs';
import { eslint } from 'rollup-plugin-eslint';
import externals from 'rollup-plugin-node-externals';
import json from '@rollup/plugin-json';
import multiEntry from '@rollup/plugin-multi-entry';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import serve from 'rollup-plugin-serve';
import typescript from 'rollup-plugin-typescript2';
import visualizer from 'rollup-plugin-visualizer';
import yaml from '@rollup/plugin-yaml';

const flag_debug = process.env['DEBUG'] === 'TRUE';
const flag_serve = process.env['SERVE'] === 'TRUE';

const metadata = require('../package.json');

const external = require('./rollup-external.json').names;

const rootPath = process.env['ROOT_PATH'];
const targetPath = process.env['TARGET_PATH'];

const testModules = [
	'chai',
	'chai-as-promised',
	'sinon',
	'sinon-chai',
];

const bundle = {
	external,
	input: {
		include: [
			join(rootPath, 'src', 'index.ts'),
			join(rootPath, 'test', 'harness.ts'),
			join(rootPath, 'test', '**', 'Test*.ts'),
		],
	},
	manualChunks(id) {
		if (id.includes(`${sep}test${sep}`)) {
			return 'test';
		}

		if (id.match(/commonjs-external/i) || id.match(/commonjsHelpers/)) {
			return 'vendor';
		}

		if (id.match(/node-resolve:/) || id.match(/virtual:/)) {
			return 'vendor';
		}

		if (testModules.some(mod => id.includes(`${sep}${mod}${sep}`))) {
			return 'test';
		}

		if (id.includes(`node_modules${sep}`)) {
			return 'vendor';
		}

		if (id.includes(`${sep}src${sep}index`)) {
			return 'index';
		}

		if (id.includes(`${sep}src${sep}`) || id.includes(`${sep}rules${sep}`)) {
			return 'main';
		}

		if (id.includes(process.env['HOME'])) {
			return 'linked';
		}

		if (id.length === 30 && id.match(/^[a-f0-9]+$/)) {
			return 'vendor';
		}

		if (flag_debug) {
			console.log('file does not belong to any chunk:', id);
		}

		return 'nochunk';
	},
	output: {
		dir: targetPath,
		chunkFileNames: '[name].js',
		entryFileNames: 'entry-[name].js',
		exports: 'named',
		format: 'cjs',
		minifyInternalExports: false,
		sourcemap: true,
	},
	plugins: [
		multiEntry(),
		json(),
		yaml(),
		externals({
			builtins: true,
			deps: true,
			devDeps: false,
			peerDeps: false,
		}),
		replace({
			delimiters: ['{{ ', ' }}'],
			values: {
				BUILD_JOB: process.env['CI_JOB_ID'],
				BUILD_RUNNER: process.env['CI_RUNNER_DESCRIPTION'],
				GIT_BRANCH: process.env['CI_COMMIT_REF_SLUG'],
				GIT_COMMIT: process.env['CI_COMMIT_SHA'],
				NODE_VERSION: process.env['NODE_VERSION'],
				PACKAGE_NAME: metadata.name,
				PACKAGE_VERSION: metadata.version,
			},
		}),
		resolve({
			preferBuiltins: true,
		}),
		commonjs(),
		eslint({
			configFile: join('.', 'config', 'eslint.json'),
			exclude: [
				join('node_modules', '**'),
				join('src', 'resource'),
				join('src', '**', '*.json'),
				join('src', '**', '*.yml'),
			],
			include: [
				join('src', '**', '*.ts'),
				join('test', '**', '*.ts'),
			],
			throwOnError: true,
			useEslintrc: false,
		}),
		typescript({
			cacheRoot: join(targetPath, 'cache', 'rts2'),
			rollupCommonJSResolveHack: true,
		}),
		visualizer({
                        filename: join(rootPath, 'out', 'bundle-graph.html'),
                        sourcemap: true,
                }),
	],
};

if (flag_serve) {
	bundle.plugins.push(serve({
		host: '0.0.0.0',
		open: true,
		verbose: true,
		contentBase: [
			join(rootPath, 'out'),
			join(rootPath, 'resources'),
		],
		mimeTypes: {
			'application/javascript': ['mjs'],
		},
	}));
}

export default [
	bundle,
];
