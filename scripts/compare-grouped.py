"""Compare every exported page and image against the authoritative source PDF."""
import json, sys, hashlib
from pathlib import Path
import fitz
from PIL import Image, ImageChops, ImageDraw
root=Path(sys.argv[1] if len(sys.argv)>1 else 'work/grouped-validation')
a,b=fitz.open(root/'original.pdf'),fitz.open(root/'grouped.pdf')
regions=json.loads((root/'regions.json').read_text());report=[]
for i,(old,new) in enumerate(zip(a,b)):
 assert old.rect==new.rect and old.rotation==new.rotation
 images=[]
 for doc,page in [(a,old),(b,new)]:
  images.append(sorted(hashlib.sha256(doc.extract_image(x[0])['image']).hexdigest() for x in page.get_images(full=True)))
 assert images[0]==images[1],f'Image changed on page {i+1}'
 po,pn=old.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False),new.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
 original=Image.frombytes('RGB',[po.width,po.height],po.samples);edited=Image.frombytes('RGB',[pn.width,pn.height],pn.samples)
 diff=ImageChops.difference(original,edited).convert('L').point(lambda p:255 if p else 0)
 mask=Image.new('L',original.size);draw=ImageDraw.Draw(mask)
 for r in regions:
  if r['page']==i+1:
   x0,y0,x1,y1=r['box'];draw.rectangle([int(x0*2)-3,int(y0*2)-3,int(x1*2)+3,int(y1*2)+3],fill=255)
 outside=ImageChops.subtract(diff,mask)
 assert outside.getbbox() is None,f'Unexpected difference on page {i+1}: {outside.getbbox()}'
 if any(r['page']==i+1 for r in regions):assert diff.getbbox(),f'No edited text on page {i+1}'
 edited.save(root/f'grouped-page-{i+1}.png')
 if i==5:
  original.crop((140,470,1090,1080)).save(root/'maggie-before.png')
  edited.crop((140,470,1090,1080)).save(root/'maggie-after.png')
 report.append({'page':i+1,'differencesOutsideEditedRegions':0,'imageBytesIdentical':True})
for i in range(12):
 original=Image.open(root/f'pdfjs/original-{i+1}.png').convert('RGB');edited=Image.open(root/f'pdfjs/edited-{i+1}.png').convert('RGB')
 diff=ImageChops.difference(original,edited);mask=Image.new('L',original.size);draw=ImageDraw.Draw(mask)
 for r in regions:
  if r['page']==i+1:
   x0,y0,x1,y1=r['box'];draw.rectangle([int(x0*2)-3,int(y0*2)-3,int(x1*2)+3,int(y1*2)+3],fill=255)
 diff.paste((0,0,0),(0,0),mask);assert diff.getbbox() is None,f'PDF.js difference outside edited region: page {i+1}'
(root/'comparison.json').write_text(json.dumps(report,indent=2));print('24 page comparisons (MuPDF and PDF.js) at 144 dpi: differences confined to grouped text regions; all embedded images byte-identical.')
