"""Deterministic editorial title cards; these are not product screenshots."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
root=Path(__file__).resolve().parents[2]
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
for product, title, subtitle, accent in [
 ('crm','Customer relationships.','Bring customers back.',(49,93,168)),
 ('website','Your garden centre.','Beautifully online.',(134,100,68)),
 ('ecomm','Your next online sale.','Make it easier to manage.',(70,101,117)),
]:
 image=Image.new('RGB',(1200,630),(246,248,250));d=ImageDraw.Draw(image)
 d.rounded_rectangle((760,-120,1310,500),radius=140,fill=tuple(round(v*.12+255*.88) for v in accent))
 logo=Image.open(root/'public/pos/features-assets/bloomsuite-logo.png').convert('RGBA');logo.thumbnail((54,54));image.paste(logo,(65,58),logo)
 d.text((133,58),'BloomSuite',font=ImageFont.truetype(bold,34),fill=(24,38,57))
 d.text((65,157),{'crm':'CRM','website':'WEBSITE BUILDER','ecomm':'E-COMMERCE'}[product]+' / FEATURE FINDER',font=ImageFont.truetype(bold,19),fill=accent)
 d.text((62,220),title,font=ImageFont.truetype(bold,58),fill=(24,38,57))
 d.text((65,305),subtitle,font=ImageFont.truetype(font,42),fill=accent)
 d.line((65,430,1135,430),fill=(210,219,230),width=2)
 d.text((65,473),'36 practical guides  /  Comparisons  /  Your demo shortlist',font=ImageFont.truetype(font,23),fill=(82,97,118))
 d.text((65,550),'bloomsuite.app',font=ImageFont.truetype(bold,20),fill=(24,38,57))
 image.save(root/f'public/product-guides/{product}-social.png',optimize=True)
