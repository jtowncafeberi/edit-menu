import {defineConfig} from 'vite';
export default defineConfig(({mode}) => ({publicDir:'static',build:{target:'es2022',outDir:'dist/client'},define:mode === 'vercel' ? {'import.meta.env.VITE_MENU_STORAGE':JSON.stringify('local')} : {}}));
