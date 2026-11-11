import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createEngine} from './engine.js';
const d=JSON.parse(fs.readFileSync('static/data.json'));
const original=new Uint8Array(Buffer.concat(JSON.parse(fs.readFileSync('static/source.json')).parts.map(n=>fs.readFileSync('static/'+n))));
const engine=createEngine(d,original,new Uint8Array(fs.readFileSync('static/fonts.pdf')));
const groups=engine.editableFields.filter(f=>f.lines),edits={};
assert.equal(groups.length,33);
assert.deepEqual(await engine.exportPDF({}),original);
const covered=new Set();
for(const f of groups){
 for(const id of f.members){assert(!covered.has(id));covered.add(id);assert(!engine.editableFields.some(v=>v.id===id));}
 // Shortening each line exercises every grouped object, font, alignment and baseline.
 edits[f.id]=f.text.split('\n').map(line=>line.trim().split(' ').slice(0,-1).join(' ')||line.slice(0,-1)).join('\n');
 if(f.id==='group-p12-kids-combo')edits[f.id]='KID\nCOMBO';
 engine.validate({[f.id]:edits[f.id]});
 assert.equal(engine.valueFor(f,engine.setValue(f,edits[f.id],{})),edits[f.id]);
 assert.deepEqual(engine.setValue(f,f.text,{[f.id]:edits[f.id]}),{});
}
engine.validate(edits);
assert.throws(()=>engine.plan(groups.find(f=>f.id==='group-p12-kids-combo'),'KID\nCOMB'),/separate outline/);
const plain=groups.find(f=>f.id==='group-p6-plain-maggie-description');
assert(plain.text.includes('&'));
const legacy={ [plain.members[0]]:'Lovely' };
assert(engine.valueFor(plain,legacy).startsWith('Lovely Maggie:'));
const migrated=engine.setValue(plain,'Fresh noodles, masala & love.',legacy);
assert(!Object.hasOwn(migrated,plain.members[0]));engine.validate(migrated);
assert(engine.plan(plain,migrated[plain.id]).length===2);
assert.throws(()=>engine.validate({...legacy,[plain.id]:'Fresh noodles'}),/both a paragraph/);
assert.throws(()=>engine.plan(plain,'Too\nmany\nlines'),/room for 2/);
assert.throws(()=>engine.plan(plain,'a'.repeat(601)),/600/);
const output=process.env.GROUP_AUDIT_DIR||'work/grouped-validation';fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(output+'/original.pdf',original);
fs.writeFileSync(output+'/grouped.pdf',await engine.exportPDF(edits));
fs.writeFileSync(output+'/wrapped.pdf',await engine.exportPDF(migrated));
fs.writeFileSync(output+'/regions.json',JSON.stringify(groups.map(f=>({id:f.id,page:f.page,box:engine.bounds(f,edits[f.id]),value:edits[f.id]}))));
console.log(`${groups.length} grouped regions: original-byte identity, all grouped edits, legacy edits, reset, wrapping, and validation passed.`);
