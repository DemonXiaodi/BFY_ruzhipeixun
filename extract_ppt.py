import zipfile, re, sys
from xml.etree import ElementTree as ET

path = r"C:\Users\BFE\Documents\WXWork\1688854300860450\WeDrive\广州市贝法易信息科技有限公司\迎新培训课件\出口易业务介绍-新员工入职培训-刘海敏.pptx"
z = zipfile.ZipFile(path)
names = [n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)]
names.sort(key=lambda n: int(re.search(r'(\d+)', n).group(1)))

ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}

def slide_text(xml):
    root = ET.fromstring(xml)
    texts = []
    for p in root.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}p'):
        line = ''.join(t.text or '' for t in p.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}t'))
        texts.append(line)
    return [t for t in texts if t.strip()]

for n in names:
    idx = int(re.search(r'(\d+)', n).group(1))
    txts = slide_text(z.read(n))
    print(f"\n========== SLIDE {idx} ==========")
    for t in txts:
        print(t)
