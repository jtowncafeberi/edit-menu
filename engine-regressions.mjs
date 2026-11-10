import fs from 'node:fs';import assert from 'node:assert/strict';import {createEngine} from './engine.js';
const data=JSON.parse(fs.readFileSync('static/data.json')),original=new Uint8Array(Buffer.concat(JSON.parse(fs.readFileSync('static/source.json')).parts.map(n=>fs.readFileSync('static/'+n)))),engine=createEngine(data,original,new Uint8Array(fs.readFileSync('static/fonts.pdf')));
const pill=data.fields.find(f=>f.page===10&&f.text==='149'&&f.bbox[0]>300);
assert.throws(()=>engine.validate({[pill.id]:'9999'}),/overlap|neighbour/);
const quantity=data.fields.find(f=>f.page===12&&f.text==='500');
assert.equal(quantity.kind,'quantity');assert.throws(()=>engine.validate({[quantity.id]:'5'}),/inline quantity/);engine.validate({[quantity.id]:'555'});
const burger=data.fields.find(f=>f.page===2&&f.text==='69'),box=engine.bounds(burger,'149');assert.ok(box[0]<engine.bounds(burger)[0]);assert.ok(box[2]<=engine.bounds(burger)[2]+.1);
const pasta=data.fields.find(f=>f.page===8&&f.text==='119');assert.throws(()=>engine.validate({[pasta.id]:'149'}),/no.*glyph/);
assert.throws(()=>engine.validate({unknown:'99'}),/unknown menu field/);assert.throws(()=>engine.validate({[burger.id]:'99\n100'}),/single line/);assert.deepEqual(await engine.exportPDF({}),original);
const report=JSON.parse(fs.readFileSync(process.env.AUDIT_REPORT||'work/audit/exports/report.json')),edits={},regions={};
for(const field of data.fields){const result=report.results.find(r=>r.id===field.id&&r.pass);assert.ok(result,field.id);const next={...edits,[field.id]:result.value};engine.validate(next);edits[field.id]=result.value;(regions[field.page]??=[]).push(engine.bounds(field),engine.bounds(field,result.value));}
const output=process.env.REGRESSION_OUTPUT||'work/audit/combined';fs.mkdirSync(output,{recursive:true});fs.writeFileSync(output+'/edits.json',JSON.stringify({edits,regions}));fs.writeFileSync(output+'/menu.pdf',await engine.exportPDF(edits));console.log('Regressions passed; combined export contains '+Object.keys(edits).length+' simultaneous valid changes.');
