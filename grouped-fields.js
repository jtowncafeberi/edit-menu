// Semantic editing regions. PDF text objects remain the authoritative artwork.
const definitions = [
 [2,'classic-lemonade','name','left',[[4086,4116]]],
 [4,'pan-fried','name','left',[[1131,1153]]],
 [6,'plain-maggie-description','description','center',[[2524,2554],[2581,2613,'ampersand',2659]]],
 [6,'cheese-maggie-description','description','center',[[1927,1951,1981,2009],[2024,2056,2084]]],
 [6,'tandoori-maggie-description','description','center',[[2317,2343,2373,2399],[2420,2452,2482]]],
 [6,'jtown-maggie-description','description','center',[[2682,2716,2744],[2771,2799,2825,2855]]],
 [6,'veg-poha-description','description','center',[[1788],[1843]]],
 [6,'jtown-poha-description','description','center',[[2153],[2212]]],
 [7,'chilli-garlic-noodles','name','center',[[1248],[1279]]],
 [7,'hakka-description','description','center',[[3239],[3296]]],
 [7,'singapuri-description','description','center',[[1654],[1713]]],
 [7,'schezwan-description','description','center',[[1758],[1817]]],
 [7,'chilli-garlic-description','description','center',[[3339],[3390]]],
 [7,'cheese-noodles-description','description','center',[[1418],[1469]]],
 [7,'veg-noodles-description','description','center',[[1864],[1935]]],
 [8,'alfredo-white-pasta','name','right',[['1395:7'],['1395:38']]],
 [8,'tandoori-makhani-pasta','name','left',[[1811],[1848]]],
 [8,'arrabbiata-red-pasta','name','left',[[2214],[2247]]],
 [9,'coffee-quotation','text','left',[[599],[674]]],
 [9,'hazelnut-description','description','left',[[959],[1006]]],
 [9,'cappuccino-description','description','left',[[1039],[1080],[1131]]],
 [9,'cold-coffee-description','description','left',[[1174],[1229]]],
 [9,'caramel-description','description','left',[[1288],[1339]]],
 [10,'tangy-paneer-description','description','left',[[1249],[1334]]],
 [11,'customise-description','description','left',[[1582],[1649]]],
 [12,'kids-combo','name','center',[[3134],[3160]]],
 [12,'special-combo','name','center',[[3192],[3215]]],
 [12,'party-combo','name','center',[[3317],[3334]]],
 [12,'family-combo','name','center',[[3357],[3378]]],
 [12,'family-combo-description','description','center',[[2315],[2322],[2329]]],
 [12,'kids-combo-description','description','center',[[2360],[2367],[2374]]],
 [12,'party-combo-description','description','center',[[2389],[2396],[2403],[2410]]],
 [12,'special-combo-description','description','center',[[2439],[2446],[2453],[2460]]],
];
const union = boxes => [Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];
const baseTracking=g=>g.length>1?(g.at(-1).x-g[0].x-g.slice(0,-1).reduce((sum,v)=>sum+v.width,0))/(g.length-1):0;
export function groupedFields(data, blocks) {
 const groups=[], hidden=new Set();
 for(const [page,key,kind,align,rows] of definitions){
  const pageFields=data.fields.filter(f=>f.page===page), members=[];
  const lines=rows.map(row=>{
   const parts=row.map(token=>{
    if(token==='ampersand'){
     const anchor=pageFields.find(f=>f.block.endsWith('-b2613')), source=data.streams[anchor.xref].source;
     const original='BT\n/F93 11.8199997 Tf\n1 0 0 -1 102.015625 11 Tm\n<0299> Tj\nET';
     const offset=source.indexOf(original);if(offset<0)throw Error('Original ampersand object not found.');
     const base=blocks.get(anchor.block).glyphs[0],cid=665,font=data.fonts[base.font];
     const glyph={...base,char:'&',cid,x:102.015625,width:(font.widths[cid]??font.defaultWidth)*base.size/1000};
     const block={id:'p6-description-ampersand',offset,original,matrix:[1,0,0,-1],glyphs:[glyph]};blocks.set(block.id,block);
     const dx=(glyph.x-base.x)*anchor.frame.scale,left=anchor.frame.origin[0]+dx;
     return {...anchor,id:block.id,block:block.id,a:0,b:1,text:'&',bbox:[left,anchor.bbox[1],left+glyph.width*anchor.frame.scale,anchor.bbox[3]],frame:{...anchor.frame,origin:[left,anchor.frame.origin[1]],box:[left,anchor.bbox[1],left+glyph.width*anchor.frame.scale,anchor.bbox[3]],width:glyph.width}};
    }
    const suffix=String(token).includes(':')?`-x${String(token).replace(':','-b')}`:`-b${token}`;
    const matches=pageFields.filter(f=>f.block.endsWith(suffix));
    if(!matches.length)throw Error(`Missing semantic text object: page ${page}, ${token}`);
    members.push(...matches.map(f=>f.id));
    const field=matches[0],block=blocks.get(field.block),first=block.glyphs[0],old=block.glyphs[field.a],scale=field.frame.scale;
    // Combo quantities share a text object with the rest of the description.
    // Include the entire object, so the paragraph really is one editable region.
    const left=field.frame.origin[0]+(first.x-old.x)*scale,width=(block.glyphs.at(-1).x+block.glyphs.at(-1).width-first.x)*scale;
    return {...field,a:0,b:block.glyphs.length,text:block.glyphs.map(g=>g.char).join(''),bbox:[left,field.bbox[1],left+width,field.bbox[3]],frame:{...field.frame,origin:[left,field.frame.origin[1]],box:[left,field.frame.box[1],left+first.width*scale,field.frame.box[3]],width:first.width}};
   });
   const first=parts[0],base=blocks.get(first.block).glyphs[0],scale=first.frame.scale;
   const originalGlyphs=parts.flatMap(part=>{const glyphs=blocks.get(part.block).glyphs;return glyphs.map(g=>({...g,x:base.x+(part.frame.origin[0]-first.frame.origin[0])/scale+(g.x-glyphs[0].x)*part.frame.scale/scale,y:base.y}));});
   return {...first,parts,originalGlyphs,kind,tracking:baseTracking(blocks.get(first.block).glyphs),bbox:union(parts.map(f=>f.bbox)),text:parts.map(f=>f.text).join(' '),align,groupLine:true};
  });
  const bbox=union(lines.map(l=>l.bbox)),width=bbox[2]-bbox[0];
  for(const line of lines){line.maxWidth=align==='center'?Math.max(line.bbox[2]-line.bbox[0],width-2*Math.abs((line.bbox[0]+line.bbox[2]-bbox[0]-bbox[2])/2)):width;}
  const group={id:`group-p${page}-${key}`,page,kind,font:lines[0].font,size:lines[0].size,bbox,lines,members:[...new Set(members)],text:lines.map(l=>l.text).join('\n')};
  group.members.forEach(id=>hidden.add(id));groups.push(group);
 }
 return {groups,editableFields:[...data.fields.filter(f=>!hidden.has(f.id)),...groups]};
}
