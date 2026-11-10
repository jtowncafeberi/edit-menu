import {build} from 'esbuild';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
await mkdir('dist/server', {recursive: true});
await build({entryPoints: ['server/worker.js'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, outfile: 'dist/server/index.js'});
await writeFile('dist/server/wrangler.json', JSON.stringify({name: 'jtown-menu-editor', main: './index.js', compatibility_date: '2026-11-11', assets: {directory: '../client', binding: 'ASSETS'}, d1_databases: [{binding: 'DB', database_name: 'jtown-menu', database_id: '00000000-0000-4000-8000-000000000000'}]}, null, 2));
try { const config = JSON.parse(await readFile('.openai/hosting.json', 'utf8')); await mkdir('dist/.openai', {recursive: true}); await writeFile('dist/.openai/hosting.json', JSON.stringify(config)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
