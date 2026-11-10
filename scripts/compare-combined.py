import fitz,json,pikepdf,os
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw
root=Path('.');out=Path(os.environ.get('AUDIT_ROOT','work/audit'));edit=json.load(open(out/'combined/edits.json'));manifest=json.load(open(root/'static/source.json'));a=fitz.open(stream=b''.join((root/'static'/n).read_bytes()for n in manifest['parts']),filetype='pdf');b=fitz.open(out/'combined/menu.pdf');report=[]
for renderer in ['MuPDF','PDF.js']:
 for i in range(12):
  def render(p):
   pix=p.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False);return Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
  if renderer=='MuPDF':ia,ib=render(a[i]),render(b[i])
  else:ia,ib=Image.open(out/f'pdfjs/original-{i+1}.png').convert('RGB'),Image.open(out/f'pdfjs/edited-{i+1}.png').convert('RGB')
  assert ia.size==ib.size
  diff=ImageChops.difference(ia,ib);mask=Image.new('L',ia.size);draw=ImageDraw.Draw(mask)
  for x0,y0,x1,y1 in edit['regions'].get(str(i+1),[]):draw.rectangle((int((x0-1.5)*2),int((y0-1.5)*2),int((x1+1.5)*2)+1,int((y1+1.5)*2)+1),fill=255)
  outside=diff.copy();outside.paste((0,0,0),(0,0),mask);bad=outside.getbbox();report.append({'renderer':renderer,'page':i+1,'outside':bad,'changed':diff.getbbox()})
  if bad:outside.save(out/f'combined/OUTSIDE-{renderer}-{i+1}.png')
import io
p=pikepdf.open(io.BytesIO(b''.join((root/'static'/n).read_bytes()for n in manifest['parts'])));q=pikepdf.open(out/'combined/menu.pdf');images=0
for obj in p.objects:
 if isinstance(obj,pikepdf.Stream)and obj.get('/Subtype')=='/Image':assert obj.read_raw_bytes()==q.get_object(*obj.objgen).read_raw_bytes();images+=1
json.dump({'simultaneousEdits':len(edit['edits']),'originalImageStreamsPreserved':images,'comparisons':report},open(out/'combined/report.json','w'),indent=2);print(json.dumps({'comparisons':len(report),'failures':[r for r in report if r['outside']],'imageStreams':images,'simultaneousEdits':len(edit['edits'])},indent=2));assert all(r['outside']is None for r in report)
