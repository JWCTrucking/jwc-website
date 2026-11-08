from pathlib import Path
import re,html,json
r=Path(__file__).resolve().parents[1];source=(r/'safety/JWC-Safety-Program.md').read_text()
def inline(s):
 s=html.escape(s)
 s=re.sub(r'\*\*(.+?)\*\*',r'<strong>\1</strong>',s)
 s=re.sub(r'https?://[^\s<]+',lambda m:'<a href="'+m.group()+'" target="_blank" rel="noopener">'+m.group()+'</a>',s)
 return s
parts=[];toc=[];paragraph=[];listkind=None;section=False

def flush():
 if paragraph:parts.append('<p>'+'<br>'.join(inline(x.rstrip()) for x in paragraph)+'</p>');paragraph.clear()
def endlist():
 global listkind
 if listkind:parts.append('</'+listkind+'>');listkind=None
for line in source.splitlines():
 if line.startswith('![JWC Contracting Ltd.]') or line.startswith('# '):continue
 if line.startswith('!['):
  flush();endlist();image=re.match(r'!\[(.*?)\]\((.*?)\)',line)
  if image:parts.append('<figure class="approval-signature"><img src="'+html.escape(image[2],quote=True)+'" alt="'+html.escape(image[1],quote=True)+'"></figure>')
  continue
 if line.startswith('## '):
  flush();endlist()
  if section:parts.append('</section>')
  heading=line[3:];slug=re.sub(r'[^a-z0-9]+','-',heading.lower()).strip('-');toc.append((slug,heading));parts.append('<section id="'+slug+'"><h2>'+inline(heading)+'</h2>');section=True
 elif not line.strip():flush();endlist()
 else:
  match=re.match(r'(- |\d+\. )(.*)',line)
  if match:
   flush();kind='ul' if match[1]=='- ' else 'ol'
   if listkind!=kind:endlist();listkind=kind;parts.append('<'+kind+'>')
   parts.append('<li>'+inline(match[2])+'</li>')
  else:endlist();paragraph.append(line)
flush();endlist()
if section:parts.append('</section>')
body='\n'.join(parts);nav=''.join('<li><a href="#'+slug+'">'+html.escape(label)+'</a></li>' for slug,label in toc)
page='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Safety Program · Alberta Oilfield Trucking &amp; Heavy Hauling | JWC</title><meta name="description" content="JWC Contracting Ltd. safety and carrier compliance program for Alberta oilfield pipe transport, equipment moves and heavy hauling. Hours of service, cargo securement, inspections, maintenance and field safety."><link rel="canonical" href="https://www.jwchauling.com/safety/"><meta name="theme-color" content="#08090b"><meta property="og:title" content="Safety · JWC Contracting Ltd."><meta property="og:description" content="Our Alberta oilfield trucking and heavy hauling safety and carrier compliance program."><meta property="og:url" content="https://www.jwchauling.com/safety/"><meta property="og:type" content="article"><meta property="og:image" content="https://www.jwchauling.com/assets/jwc-hero.png"><style>
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px;color-scheme:dark}body{margin:0;background:#080b10;color:#d5dde7;font:16px/1.75 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif}a{color:#cbd8e9;text-underline-offset:4px}header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px max(20px,calc((100vw - 1180px)/2));border-bottom:1px solid #303945;background:#0b0e13}.brand{display:block;width:190px;overflow:hidden;flex-shrink:0}.brand img{display:block;width:143%;height:auto;margin-left:-43%}header nav{display:flex;flex-wrap:wrap;gap:20px}header nav a{text-decoration:none;font-size:13px;font-weight:750;letter-spacing:.06em}header nav a[aria-current=page]{color:white;border-bottom:1px solid #a6bacf}.hero{max-width:1180px;margin:auto;padding:64px 20px 40px}.eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9eafc3;font-weight:750}h1{font-size:clamp(44px,7vw,76px);line-height:1.1;letter-spacing:-.04em;color:#f2f5f9;margin:16px 0}.lead{max-width:800px;color:#bdcad9;font-size:clamp(18px,2.5vw,23px);margin:0 0 24px}.scope{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}.scope span{padding:6px 12px;border:1px solid #344255;border-radius:99px;font-size:13px}.downloads{display:flex;flex-wrap:wrap;gap:12px;margin:28px 0}.downloads a,.print-button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:11px 18px;border-radius:8px;border:1px solid #687b93;font:700 14px system-ui;text-decoration:none;background:#dfe8f3;color:#101722;cursor:pointer}.downloads .secondary{background:transparent;color:#cad6e6}.approval{font-size:14px;color:#a8b7ca}.approval strong{color:#e8eef6}.layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:48px;max-width:1180px;margin:auto;padding:0 20px 72px;align-items:start}.contents{position:sticky;top:20px;padding:18px;border:1px solid #2d394a;border-radius:12px;background:#101720;max-height:calc(100vh - 40px);overflow-y:auto}.contents summary{cursor:pointer;font-size:14px;font-weight:750;color:#e2eaf5}.contents ol{list-style:none;padding:0;margin:16px 0 0}.contents li{margin:0 0 11px;font-size:12px;line-height:1.5}.contents a{text-decoration:none;color:#9eb0c8}.contents a:hover{color:white}article{min-width:0}article>p{font-size:13px;color:#9eb0c5;padding:18px;border:1px solid #2d394a;border-radius:12px;background:#101720}article section{padding:6px 0 24px;border-bottom:1px solid #29323f;margin-bottom:24px}h2{color:#eef3f9;font-size:25px;letter-spacing:-.025em;line-height:1.3;margin:20px 0}article p,article li{overflow-wrap:anywhere}article p{margin:0 0 18px}article ul,article ol{padding-left:22px}article li{margin-bottom:12px}article strong{color:#eef3f9}.approval-signature{background:white;border-radius:8px;padding:12px;max-width:360px;margin:18px 0}.approval-signature img{display:block;width:100%;height:auto}footer{padding:26px 20px;text-align:center;border-top:1px solid #303945;font-size:13px;color:#9eafc3}a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid #e5effc;outline-offset:4px}
@media(max-width:800px){header{align-items:flex-start;padding:16px}.brand{width:145px}header nav{gap:12px;justify-content:flex-end;max-width:200px}header nav a{font-size:11px}.hero{padding:36px 18px 24px}.layout{grid-template-columns:1fr;gap:24px;padding:0 18px 44px}.contents{position:static;max-height:none}h2{font-size:23px}}
@media print{html{color-scheme:light;scroll-behavior:auto}body{color:#222;background:white;font:11pt/1.5 Arial,sans-serif}header,aside,.downloads,footer,.scope{display:none}.hero{padding:0 0 20px}.eyebrow,.lead,.approval,h1,h2,article strong{color:black}h1{font-size:32pt}.layout{display:block;padding:0;max-width:none}article>p{color:black;background:white;border:1px solid #aaa}article section{border:0;padding-bottom:6px;margin-bottom:12px}h2{font-size:16pt;break-after:avoid}a{color:black}article p,li{orphans:3;widows:3}}
</style></head><body><header><a class="brand" href="../" aria-label="JWC Contracting Ltd. home"><img src="../assets/jwc-logo-form.png" alt="JWC Contracting Ltd. official logo" width="600" height="194"></a><nav aria-label="Company navigation"><a href="../">HOME</a><a href="../fleet/">OUR FLEET</a><a href="./" aria-current="page">SAFETY</a><a href="../#contact">CONTACT</a></nav></header><main><div class="hero"><p class="eyebrow">JWC Contracting Ltd. · Peace River, Alberta</p><h1>Safety</h1><p class="lead">Our safety and carrier compliance program for oilfield trucking, pipe transport and heavy equipment hauling.</p><div class="scope"><span>Alberta-only operations</span><span>Non-dangerous oilfield cargo</span><span>Revision 3.7 · November 7, 2019</span></div><div class="downloads"><a href="JWC-Safety-Program.pdf?v=3.7" download>Download full safety program · PDF</a><a class="secondary" href="JWC-Safety-Program.docx?v=3.7" download>Download Word manual</a><a class="secondary" href="JWC-Safety-Program.md" download>Download editable text</a><button class="print-button secondary" type="button" onclick="window.print()">Print program</button></div><p class="approval">Approved and issued by <strong>Jordan Cowan, CEO</strong> · CEO mission statement and approval included below.</p></div><div class="layout"><aside class="contents"><details open id="program-contents"><summary>Program contents</summary><ol>'''+nav+'''</ol></details></aside><article aria-label="JWC safety and carrier compliance program">'''+body+'''</article></div></main><footer>JWC Contracting Ltd. · <a href="tel:+17806256837">780-625-6837</a> · <a href="mailto:dispatch@jwchauling.com">dispatch@jwchauling.com</a> · <a href="../privacy/">Privacy</a></footer><script>if(matchMedia('(max-width:800px)').matches)document.getElementById('program-contents').open=false;</script></body></html>'''
(r/'safety/index.html').write_text(page)
# Both public company navigation menus point to the real Safety page.
for filename in ['index.html','fleet/index.html']:
 p=r/filename;s=p.read_text();s=re.sub(r'href="mailto:dispatch@jwchauling.com\?subject=Safety%20inquiry"', 'href="'+('safety/' if filename=='index.html' else '../safety/')+'"',s);p.write_text(s)
p=r/'sitemap.xml';s=p.read_text();entry='<url><loc>https://www.jwchauling.com/safety/</loc></url>';s=s if entry in s else s.replace('</urlset>',entry+'</urlset>');p.write_text(s)
print('Rendered',len(toc),'program sections')
