import fs from 'node:fs';import path from 'node:path';import {createCanvas} from '@napi-rs/canvas';import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const output=path.resolve(process.env.PDFJS_OUTPUT||'work/audit/pdfjs');fs.mkdirSync(output,{recursive:true});
const original=new Uint8Array(Buffer.concat(JSON.parse(fs.readFileSync('static/source.json')).parts.map(n=>fs.readFileSync('static/'+n))));
for(const [name,bytes]of [['original',original],['edited',new Uint8Array(fs.readFileSync(process.env.COMBINED_PDF||'work/audit/combined/menu.pdf'))]]){
 const document=await pdfjs.getDocument({data:bytes}).promise;
 for(let index=1;index<=document.numPages;index++){const page=await document.getPage(index),viewport=page.getViewport({scale:2}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;fs.writeFileSync(path.join(output,`${name}-${index}.png`),canvas.toBuffer('image/png'));page.cleanup();}
 await document.destroy();console.log(`Rendered ${name} PDF: 12 pages with PDF.js.`);
}
