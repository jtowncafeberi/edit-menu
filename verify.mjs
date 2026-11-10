import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createEngine} from './engine.js';
const d=JSON.parse(fs.readFileSync('static/data.json')),o=new Uint8Array(Buffer.concat(JSON.parse(fs.readFileSync('static/source.json')).parts.map(name=>fs.readFileSync('static/'+name)))),e=createEngine(d,o,new Uint8Array(fs.readFileSync('static/fonts.pdf')));
assert.deepEqual(await e.exportPDF({}),o);
const engineBounds=f=>e.bounds(f);
const output=process.env.VERIFY_DIR||'work/validation';fs.mkdirSync(output,{recursive:true});const edits={},chosen=[];
for(let page=2;page<=12;page++){
 const f=d.fields.find(f=>f.page===page&&f.kind==='price'&&/^\d{2,4}$/.test(f.text));let value=page===6?'140':page===9?'160':page%2?'159':'9';try{e.plan(f,value);}catch{value='5';e.plan(f,value);}edits[f.id]=value;chosen.push({...f,value});
}
const f=d.fields.find(f=>f.page===2&&f.text==='Aloo Tikki Burger');edits[f.id]='Aloo Burger';e.plan(f,edits[f.id]);chosen.push({...f,value:edits[f.id]});
for(const [page,from,to] of [[6,'Plain Maggie','Plain Maggi'],[8,'Mix Pasta','Pasta'],[10,'ONION','CORN']]){const field=d.fields.find(f=>f.page===page&&f.text===from);e.plan(field,to);edits[field.id]=to;chosen.push({...field,value:to});}
for(const field of chosen){const a=engineBounds(field),b=e.bounds(field,field.value);field.region=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];}
fs.writeFileSync(output+'/edits.json',JSON.stringify(chosen,null,2));fs.writeFileSync(output+'/edited.pdf',await e.exportPDF(edits));
const failures=[];for(const f of d.fields){try{e.plan(f,f.text);}catch(x){failures.push({id:f.id,text:f.text,error:x.message});}}
console.log(JSON.stringify({zeroEditsByteIdentical:true,representativeEdits:chosen.length,fieldValidationFailures:failures},null,2));assert.equal(failures.length,0);
