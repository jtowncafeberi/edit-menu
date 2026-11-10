import sys,json,fitz
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw
root=Path(sys.argv[1]);m=json.load(open(root/'static/source.json'));original=fitz.open(stream=b''.join((root/'static'/n).read_bytes()for n in m['parts']),filetype='pdf');cache={};out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
def readn(n):
 r=bytearray()
 while len(r)<n:
  part=sys.stdin.buffer.read(n-len(r))
  if not part:raise EOFError()
  r.extend(part)
 return bytes(r)
def render(page):
 pix=page.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False);return Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
while True:
 line=sys.stdin.buffer.readline()
 if not line:break
 try:
  info=json.loads(line);raw=readn(info['length']);p=fitz.open(stream=raw,filetype='pdf');pn=info['page']-1;assert len(p)==12;assert all(a.rect==b.rect and a.rotation==b.rotation for a,b in zip(original,p))
  if pn not in cache:cache[pn]=render(original[pn])
  a=cache[pn];b=render(p[pn]);diff=ImageChops.difference(a,b);changed=diff.getbbox();mask=Image.new('L',a.size);draw=ImageDraw.Draw(mask)
  for x0,y0,x1,y1 in info['regions']:draw.rectangle((int((x0-1.5)*2),int((y0-1.5)*2),int((x1+1.5)*2)+1,int((y1+1.5)*2)+1),fill=255)
  outside=diff.copy();outside.paste((0,0,0),(0,0),mask);bad=outside.getbbox();result={'id':info['id'],'page':pn+1,'changed':changed,'outside':bad,'pass':bad is None and changed is not None}
  if not result['pass']:
   (out/(info['id']+'.pdf')).write_bytes(raw);diff.save(out/(info['id']+'-diff.png'));a.save(out/(info['id']+'-original.png'));b.save(out/(info['id']+'-edited.png'))
  elif info.get('save'):
   box=changed;clip=(max(0,box[0]-25),max(0,box[1]-20),min(a.width,box[2]+25),min(a.height,box[3]+20));a.crop(clip).save(out/(info['id']+'-original.png'));b.crop(clip).save(out/(info['id']+'-edited.png'))
  print(json.dumps(result),flush=True)
 except Exception as error:print(json.dumps({'id':info.get('id'),'pass':False,'error':str(error)}),flush=True)
