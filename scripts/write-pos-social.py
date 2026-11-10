"""Create exact, local social-preview artwork from the published editorial titles."""
import json
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'content/pos-features.json').read_text())
MARKETING=json.loads((ROOT/'content/pos-marketing.json').read_text())
COMPARISONS=[]
for name in ['pos-comparisons-mainstream.json','pos-comparisons-garden.json']:
    COMPARISONS.extend(json.loads((ROOT/'content'/name).read_text()))
OUT=ROOT/'public/pos/features-assets/social'
OUT.mkdir(parents=True,exist_ok=True)
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
INK='#17263b';BLUE='#a9bddb';PAPER='#f8f5ee'

def font(size,bold=False):return ImageFont.truetype(BOLD if bold else FONT,size)
def wrap(draw,text,ft,width):
    lines=[];line=''
    for word in text.split():
        candidate=(line+' '+word).strip()
        if draw.textlength(candidate,font=ft)>width and line:lines.append(line);line=word
        else:line=candidate
    if line:lines.append(line)
    return lines

def create(name,title,kicker,sub):
    im=Image.new('RGB',(1200,630),INK);draw=ImageDraw.Draw(im)
    draw.rounded_rectangle((850,-130,1370,390),radius=220,outline='#2d405c',width=34)
    draw.arc((790,90,1220,780),160,300,fill='#415a7d',width=4)
    draw.arc((900,240,1180,610),180,310,fill='#415a7d',width=3)
    logo=Image.open(ROOT/'public/pos/features-assets/bloomsuite-logo.png').convert('RGBA');logo.thumbnail((46,46));im.paste(logo,(60,43),logo)
    draw.text((121,45),'BloomSuite POS',font=font(28,True),fill=PAPER)
    draw.text((62,132),kicker.upper(),font=font(18,True),fill=BLUE)
    ft=font(58,True);lines=wrap(draw,title,ft,1010)
    if len(lines)>3:ft=font(50,True);lines=wrap(draw,title,ft,1010)
    y=188
    for line in lines[:3]:draw.text((57,y),line,font=ft,fill=PAPER);y+=int(ft.size*1.22)
    draw.line((60,505,1140,505),fill='#435573',width=2)
    for i,line in enumerate(wrap(draw,sub,font(22),1000)[:2]):draw.text((62,529+i*32),line,font=font(22),fill='#d0daea')
    draw.text((1010,46),'bloomsuite.app',font=font(15),fill=BLUE)
    im.save(OUT/(name+'.webp'),quality=90,method=6)

create('pos','Run the store. Keep growing.','Garden centre point of sale','Checkout, plants, stock, customers and the details of a working day.')
create('compare','A fair comparison starts with your store.','Compare garden centre POS systems','Official sources. Practical demo questions. A careful decision.')
create('switching','A better till. A careful transition.','Garden centre POS switching guide','Review the data. Check the equipment. Rehearse with your team.')
for c in DATA['categories']:
    create('category-'+c['id'],MARKETING['categories'][c['id']]['name'],'BloomSuite POS workflow guides',c['headline'])
for f in DATA['features']:
    create(f['slug'],f['title'],'BloomSuite POS for garden centres',f['benefit'])
for c in COMPARISONS:
    create('vs-'+c['id'],'BloomSuite POS vs. '+c['name'],'A garden centre POS buying guide','Published capabilities, costs to check and questions for both demonstrations.')
print('Prepared',len(list(OUT.glob('*.webp'))),'1200 × 630 social preview images')
