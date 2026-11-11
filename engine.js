import {PDFDocument,PDFRef,PDFName,PDFRawStream,PDFDict,PDFObjectCopier} from 'pdf-lib';
import {deflate} from 'pako';
import {groupedFields} from './grouped-fields.js';
export const SOURCE_ID='jtown-8nov2026-36406128-v1';
const n=v=>Number(v.toFixed(7)).toString();
const hex=cid=>cid.toString(16).padStart(4,'0');
export function createEngine(data,original,supplement){
 const fields=new Map(data.fields.map(f=>[f.id,f]));
 const fieldsByBlock=new Map();for(const f of data.fields){if(!fieldsByBlock.has(f.block))fieldsByBlock.set(f.block,[]);fieldsByBlock.get(f.block).push(f);}
 const blocks=new Map(Object.values(data.streams).flatMap(s=>s.blocks).map(b=>[b.id,b]));
 const {groups,editableFields}=groupedFields(data,blocks);
 for(const group of groups)fields.set(group.id,group);
 function plan(field,value){
  if(field.lines)return groupPlan(field,value);
  if(typeof value!=='string'||!value.trim()||value.length>150||/[\r\n\u0000-\u001f]/.test(value))throw Error('Use a non-empty, single line of text (up to 150 characters).');
  if((field.kind==='price'||field.kind==='quantity')&&field.text!=='MRP'&&!/^\d{1,5}$/.test(value))throw Error('Enter a whole-number price, up to five digits.');
  if(field.block==='p12-x62-b3160'&&value!==field.text)throw Error('The Kids COMBO label has a separate outline in the original artwork. Its lettering must stay unchanged to preserve that artwork.');
  if(field.groupLine&&value===field.text)return field.originalGlyphs.map(g=>({...g,run:undefined}));
  const block=blocks.get(field.block),old=field.originalGlyphs??block.glyphs.slice(field.a,field.b),base=old[0];
  const family=data.fonts[base.font].name;
  const candidates=[String(base.font),...Object.keys(data.fonts).filter(k=>k!=base.font&&data.fonts[k].name===family)];
  const chars=[...value];let glyphs=[],cursor=0;
  // Retain the original tracking between glyph origins.
  let tracking=field.tracking??(old.length>1?(old.at(-1).x-old[0].x-old.slice(0,-1).reduce((s,g)=>s+g.width,0))/(old.length-1):0);
  for(const char of chars){
   let found;
   for(const font of candidates){const f=data.fonts[font];const pair=Object.entries(f.map).find(([,v])=>v===char);if(pair){const cid=+pair[0];found={char,cid,font:+font,size:base.size,width:(f.widths[cid]??f.defaultWidth)*base.size/1000};break;}}
   if(!found)throw Error(`The PDF's embedded ${family} font has no “${char}” glyph. Exact-font editing cannot use this character. Try another spelling.`);
   glyphs.push({...found,x:cursor,y:base.y});cursor+=found.width+tracking;
  }
  const inlineRun=block.runs?.find(r=>r.b-r.a>1&&field.a>=r.a&&field.b<=r.b&&(field.a>r.a||field.b<r.b));
  if(!field.groupLine&&inlineRun&&(glyphs.length!==old.length||glyphs.some((g,i)=>g.font!==old[i].font||Math.abs(g.width-old[i].width)>.000001)))throw Error('This inline quantity shares lettering with a fixed label. Keep the same digit count and printed width to preserve its spacing.');
  const width=cursor-tracking,oldWidth=old.at(-1).x+old.at(-1).width-base.x;
  const ratio=(field.bbox[2]-field.bbox[0])/oldWidth;
  if(width*ratio>field.maxWidth+.2)throw Error('This text would reach neighbouring content. Use a shorter value; the original font and size are preserved.');
  const offset=field.align==='right'?oldWidth-width:field.align==='center'?(oldWidth-width)/2:0;
  for(const g of glyphs)g.x+=base.x+offset;
  // Inline labels/units are real PDF glyphs too, even when they are not editable.
  const oldLeft=base.x,oldRight=old.at(-1).x+old.at(-1).width,newLeft=glyphs[0].x,newRight=glyphs.at(-1).x+glyphs.at(-1).width;
  let left=-Infinity,right=Infinity;
  if(!field.groupLine)block.glyphs.forEach((g,i)=>{if(Math.abs(g.y-base.y)>.01||!g.char.trim()||fieldsByBlock.get(field.block).some(f=>i>=f.a&&i<f.b))return;if(g.x+g.width<=oldLeft+.02)left=Math.max(left,g.x+g.width);if(g.x>=oldRight-.02)right=Math.min(right,g.x);});
  if(newLeft<Math.min(oldLeft,left)-.02||newRight>Math.max(oldRight,right)+.02)throw Error('This value would overlap a fixed label or unit. Use a shorter value to preserve the original spacing.');
  return glyphs;
 }
 function bounds(field,value=field.text,planned){
  if(field.lines){const originalBounds=union([field.bbox,...field.lines.map(line=>bounds(line))]);if(value===field.text)return originalBounds;return union([originalBounds,...groupPlan(field,value).map(({line,glyphs})=>bounds(line,line.text,glyphs))]);}
  const glyphs=planned??(value===field.text?(field.originalGlyphs??blocks.get(field.block).glyphs.slice(field.a,field.b)):plan(field,value)),old=field.originalGlyphs?.[0]??blocks.get(field.block).glyphs[field.a],frame=field.frame;
  if(!frame){const oldGlyphs=blocks.get(field.block).glyphs.slice(field.a,field.b),ratio=(field.bbox[2]-field.bbox[0])/(oldGlyphs.at(-1).x+oldGlyphs.at(-1).width-old.x),left=field.bbox[0]+(glyphs[0].x-old.x)*ratio;return [left,field.bbox[1],left+(glyphs.at(-1).x+glyphs.at(-1).width-glyphs[0].x)*ratio,field.bbox[3]];}
  let box=[Infinity,Infinity,-Infinity,-Infinity];
  for(const g of glyphs){const dx=(g.x-old.x)*frame.scale*frame.dir[0],dy=(g.x-old.x)*frame.scale*frame.dir[1],wx=(g.width-frame.width)*frame.scale*frame.dir[0],wy=(g.width-frame.width)*frame.scale*frame.dir[1];const cell=[frame.box[0]+dx+Math.min(0,wx),frame.box[1]+dy+Math.min(0,wy),frame.box[2]+dx+Math.max(0,wx),frame.box[3]+dy+Math.max(0,wy)];box=[Math.min(box[0],cell[0]),Math.min(box[1],cell[1]),Math.max(box[2],cell[2]),Math.max(box[3],cell[3])];}
  for(const g of glyphs){const ink=data.fonts[g.font].ink?.[g.cid];if(!ink)continue;const size=g.size*frame.scale/1000;for(const x of [ink[0],ink[2]])for(const y of [ink[1],ink[3]]){const px=frame.origin[0]+(g.x-old.x)*frame.scale*frame.dir[0]+x*size*frame.dir[0]+y*size*frame.dir[1],py=frame.origin[1]+(g.x-old.x)*frame.scale*frame.dir[1]+x*size*frame.dir[1]-y*size*frame.dir[0];box=[Math.min(box[0],px),Math.min(box[1],py),Math.max(box[2],px),Math.max(box[3],py)];}}
  return box;
 }
 const union=boxes=>[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];
 function groupPlan(field,value){
  if(typeof value==='string')value=value.replace(/\r\n?/g,'\n');
  if(typeof value!=='string'||!value.trim()||value.length>600||/[\u0000-\u0009\u000b-\u001f]/.test(value))throw Error('Use non-empty text, up to 600 characters.');
  const paragraphs=value.replace(/\r\n/g,'\n').split('\n');let index=0;const result=[];
  for(const paragraph of paragraphs){
   if(!paragraph.trim())throw Error('Remove empty lines; this region keeps its original printed line positions.');
   let words=paragraph.trim().split(/ +/),text='';
   while(words.length){
    const line=field.lines[index];if(!line)throw Error(`This region has room for ${field.lines.length} printed line${field.lines.length===1?'':'s'}. Shorten the text or remove a line break; font size stays unchanged.`);
    const candidate=text?text+' '+words[0]:words[0];
    try{plan(line,candidate);text=candidate;words.shift();}
    catch(error){if(!text||!error.message.includes('neighbouring content'))throw error;result.push({line,glyphs:plan(line,text)});index++;text='';}
   }
   result.push({line:field.lines[index],glyphs:plan(field.lines[index],text)});index++;
  }
  return result;
 }
 function valueFor(field,edits){return edits[field.id]??(field.lines?field.lines.map(line=>line.parts.map(part=>{const block=blocks.get(part.block),glyphs=block.glyphs.map(g=>g.char);for(const member of field.members.map(id=>fields.get(id)).filter(member=>member.block===part.block&&member.id in edits).sort((a,b)=>b.a-a.a))glyphs.splice(member.a,member.b-member.a,edits[member.id]);return glyphs.join('');}).join(' ')).join('\n'):field.text);}
 function changed(field,edits){return field.id in edits||!!field.members?.some(id=>id in edits);}
 function setValue(field,value,edits){const next={...edits};for(const id of field.members??[])delete next[id];delete next[field.id];if(value!==field.text)next[field.id]=value;return next;}
 const overlap=(a,b)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
 function validate(edits){
  if(!edits||typeof edits!=='object'||Array.isArray(edits)||Object.keys(edits).length>fields.size)throw Error('Invalid edits backup.');
  const changed=new Set(),boxes=new Map();
  for(const [id,v]of Object.entries(edits)){const f=fields.get(id);if(!f)throw Error('This backup contains an unknown menu field.');if(f.lines&&f.members.some(id=>id in edits))throw Error('This backup edits both a paragraph and one of its old text fragments. Reset one before importing.');if(v!==f.text){plan(f,v);changed.add(id);boxes.set(id,bounds(f,v));}}
  for(const a of groups.filter(f=>changed.has(f.id)))for(const b of groups.filter(f=>changed.has(f.id)&&f.id!==a.id&&f.page===a.page)){if(overlap(boxes.get(a.id),boxes.get(b.id))>overlap(bounds(a),bounds(b))+.5)throw Error('These changes would overlap neighbouring text. Shorten one of the values.');}
  for(const id of changed){const f=fields.get(id),box=boxes.get(id),page=data.pages[f.page-1];if(box[0]<Math.min(0,f.bbox[0])-.2||box[2]>Math.max(page.width,f.bbox[2])+.2)throw Error('This text would extend beyond the original page.');for(const other of data.fields){if(other.page!==f.page||other.id===id||f.members?.includes(other.id))continue;if(overlap(box,boxes.get(other.id)??bounds(other))>overlap(bounds(f),bounds(other))+.5)throw Error('These changes would overlap neighbouring text. Shorten one of the values.');}}
 }
 async function exportPDF(edits){
  validate(edits);const entries=Object.entries(edits).filter(([id,v])=>v!==fields.get(id).text);
  if(!entries.length)return original.slice();
  const pdf=await PDFDocument.load(original,{updateMetadata:false});
  const addedFonts=new Map();let extra;let copier;
  async function fontRef(id){if(id>0)return PDFRef.of(id);if(addedFonts.has(id))return addedFonts.get(id);if(!extra){extra=await PDFDocument.load(supplement,{updateMetadata:false});copier=PDFObjectCopier.for(extra.context,pdf.context);}const name=data.fonts[id].supplementName;const ref=extra.getPages()[0].node.Resources().lookup(PDFName.of('Font'),PDFDict).get(PDFName.of(name));const copied=copier.copy(ref);addedFonts.set(id,copied);return copied;}
  const expanded=[];
  for(const [id,value]of entries){const f=fields.get(id);if(!f.lines){expanded.push({f,value});continue;}const layout=groupPlan(f,value);for(const line of f.lines){const replacement=layout.find(item=>item.line===line);for(const [index,part]of line.parts.entries())expanded.push({f:part,glyphs:index===0&&replacement?replacement.glyphs:[]});}}
  const grouped=new Map();for(const item of expanded){const {f}=item;if(!grouped.has(f.xref))grouped.set(f.xref,new Map());const m=grouped.get(f.xref);if(!m.has(f.block))m.set(f.block,[]);m.get(f.block).push(item);}
  for(const [xref,changes]of grouped){
   const stream=pdf.context.lookup(PDFRef.of(xref));const resources=stream.dict.lookup(PDFName.of('Resources'),PDFDict);let fontdict=resources.lookup(PDFName.of('Font'),PDFDict);let source=data.streams[xref].source;
   for(const [id,editsForBlock]of [...changes].sort((a,b)=>blocks.get(b[0]).offset-blocks.get(a[0]).offset)){const block=blocks.get(id);let glyphs=[...block.glyphs];
    for(const {f,value,glyphs:replacement}of editsForBlock.sort((a,b)=>b.f.a-a.f.a))glyphs.splice(f.a,f.b-f.a,...(replacement??plan(f,value)));
    const inline=editsForBlock.some(({f})=>block.runs?.some(r=>r.b-r.a>1&&f.a>=r.a&&f.b<=r.b&&(f.a>r.a||f.b<r.b)));
    let replacement;
    if(inline){replacement=block.original;const patches=[];for(const {f,value}of editsForBlock){const run=block.runs.find(r=>f.a>=r.a&&f.b<=r.b);if(!run)throw Error('This inline text range crosses a PDF text run.');patches.push({offset:run.hexOffset+(f.a-run.a)*4,length:(f.b-f.a)*4,text:plan(f,value).map(g=>hex(g.cid)).join('')});}for(const patch of patches.sort((a,b)=>b.offset-a.offset))replacement=replacement.slice(0,patch.offset)+patch.text+replacement.slice(patch.offset+patch.length);}
    else{replacement='BT\n';
    const runs=[];for(const g of glyphs){const last=runs.at(-1);if(g.run!==undefined&&last&&last[0].run===g.run&&last[0].font===g.font){last.push(g);}else runs.push([g]);}
    for(const run of runs){const g=run[0],alias='JEdit'+g.font;fontdict.set(PDFName.of(alias),await fontRef(g.font));replacement+=`/${alias} ${n(g.size)} Tf\n${block.matrix.map(n).join(' ')} ${n(g.x)} ${n(g.y)} Tm\n<${run.map(g=>hex(g.cid)).join('')}> Tj\n`;}
    replacement+='ET';}
    if(source.slice(block.offset,block.offset+block.original.length)!==block.original)throw Error('Original text object no longer matches the source PDF.');source=source.slice(0,block.offset)+replacement+source.slice(block.offset+block.original.length);
   }
   const bytes=Uint8Array.from(source,c=>c.charCodeAt(0));const dict=stream.dict.clone(pdf.context);dict.set(PDFName.of('Filter'),PDFName.of('FlateDecode'));dict.delete(PDFName.of('DecodeParms'));pdf.context.assign(PDFRef.of(xref),PDFRawStream.of(dict,deflate(bytes)));
  }
  return pdf.save({useObjectStreams:false,addDefaultPage:false,updateFieldAppearances:false});
 }
 return {plan,bounds,validate,exportPDF,fields,blocks,editableFields,valueFor,changed,setValue};
}
