from pathlib import Path
import re,json,math
from PIL import Image,ImageDraw,ImageFont
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH,WD_BREAK,WD_TAB_ALIGNMENT,WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
r=Path(__file__).resolve().parents[1];out=r/'safety'
# Typeset the requested cursive name; this is not a reproduction of a handwritten autograph.
font=ImageFont.truetype(str(r/'safety/fonts/Allura-Regular.ttf'),150)
b=font.getbbox('Jordan Cowan');im=Image.new('RGBA',(b[2]-b[0]+44,b[3]-b[1]+38),(255,255,255,0));ImageDraw.Draw(im).text((22-b[0],18-b[1]),'Jordan Cowan',font=font,fill=(20,28,40,255));im.save(out/'Jordan-Cowan-signature.png')
p=out/'JWC-Safety-Program.md';s=p.read_text().replace('# Safety & Carrier Compliance Program','# Health & Safety Manual\n\n**Safety & Carrier Compliance Program**').replace('**Revision:** 1.0','**Revision:** 1.1')
old='''**Approved and issued by:**  
**Jordan Cowan**  
**Chief Executive Officer, JWC Contracting Ltd.**  
**Typed approval signature: Jordan Cowan**  
**November 7, 2026**'''
s=s.replace(old,'').replace('## 1. Management policy and approval','## 1. Management policy')
mission='''## Safety mission statement

Our mission is to deliver oilfield pipe, equipment and heavy loads safely, reliably and responsibly throughout Alberta. We will protect our people, our customers, the public and the environment through sound planning, competent workers, properly maintained equipment and clear communication.

Safety starts before a truck moves. We will identify hazards, respect driving and working limits, secure every load correctly and stop when conditions are unsafe. No schedule, delivery or production demand is more important than sending every person home safely.

As Chief Executive Officer, I am accountable for providing the leadership, resources and support needed to put this program into practice. Every worker is expected and empowered to take part, report concerns and stop unsafe work without fear of retaliation. We will learn from our work, correct problems and continually improve.

**Approved and issued by:**

![Jordan Cowan — cursive approval signature](Jordan-Cowan-signature.png)

**Jordan Cowan**  
Chief Executive Officer, JWC Contracting Ltd.  
November 7, 2026

'''
if '## Safety mission statement' not in s:s=s.replace('## 1. Management policy',mission+'## 1. Management policy',1)
s='\n'.join(line.rstrip() for line in s.splitlines())+'\n'
p.write_text(s)
# Author a paginated Word handbook. PDF conversion is performed separately by Adobe.
doc=Document();sec=doc.sections[0];sec.page_width=Inches(8.5);sec.page_height=Inches(11);sec.top_margin=sec.bottom_margin=Inches(.75);sec.left_margin=sec.right_margin=Inches(.8);sec.header_distance=sec.footer_distance=Inches(.28);sec.different_first_page_header_footer=True
normal=doc.styles['Normal'];normal.font.name='Arial';normal.font.size=Pt(10.5);normal.font.color.rgb=RGBColor.from_string('20252C');normal.paragraph_format.line_spacing=Pt(14);normal.paragraph_format.space_after=Pt(7)
for name,size,color in [('Title',30,'101A28'),('Heading 1',20,'14253C'),('Heading 2',15,'243950')]:
 st=doc.styles[name];st.font.name='Arial';st.font.size=Pt(size);st.font.color.rgb=RGBColor.from_string(color);st.paragraph_format.space_before=Pt(0);st.paragraph_format.space_after=Pt(15);st.paragraph_format.keep_with_next=True
header=sec.header.paragraphs[0];header.text='JWC CONTRACTING LTD.   |   HEALTH & SAFETY MANUAL';header.style=doc.styles['Normal'];header.runs[0].font.size=Pt(8);header.runs[0].font.color.rgb=RGBColor.from_string('5E6B7A')
footer=sec.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT;run=footer.add_run('JWC-HSE-001 · Rev 1.1    |    ');run.font.name='Arial';run.font.size=Pt(8)
for instr,after in [('PAGE',' of '),('NUMPAGES','')]:
 fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),instr);footer._p.append(fld);footer.add_run(after).font.size=Pt(8)
# Cover page.
pic=doc.add_paragraph();pic.alignment=WD_ALIGN_PARAGRAPH.CENTER;pic.paragraph_format.space_before=Pt(38);pic.paragraph_format.space_after=Pt(65);pic.add_run().add_picture(str(r/'assets/jwc-logo-form.png'),width=Inches(5.6))
for text,size,bold,after in [('JWC CONTRACTING LTD.',15,True,20),('HEALTH & SAFETY\nMANUAL',30,True,24),('Oilfield Trucking · Pipe Transport\nHeavy Equipment Hauling',16,False,45)]:
 p1=doc.add_paragraph();p1.alignment=WD_ALIGN_PARAGRAPH.CENTER;p1.paragraph_format.space_after=Pt(after);p1.paragraph_format.line_spacing=1.15;run=p1.add_run(text);run.font.name='Arial';run.font.size=Pt(size);run.bold=bold;run.font.color.rgb=RGBColor.from_string('14253C')
for text in ['ALBERTA OPERATIONS','JWC-HSE-001  |  Revision 1.1','Effective November 7, 2026','Peace River, Alberta  |  780-625-6837','dispatch@jwchauling.com']:
 p1=doc.add_paragraph(text);p1.alignment=WD_ALIGN_PARAGRAPH.CENTER;p1.paragraph_format.space_after=Pt(5)
doc.add_page_break()
# Dedicated CEO mission page.
doc.add_heading('OUR SAFETY MISSION',0)
for para in re.split(r'\n\s*\n',mission.split('## Safety mission statement\n\n')[1].split('**Approved and issued by:**')[0].strip()):doc.add_paragraph(para)
p1=doc.add_paragraph('Approved and issued by:');p1.paragraph_format.space_before=Pt(24)
p1=doc.add_paragraph();p1.add_run().add_picture(str(out/'Jordan-Cowan-signature.png'),width=Inches(3.35));p1.paragraph_format.space_after=Pt(1)
p1=doc.add_paragraph();p1.add_run('Jordan Cowan').bold=True;p1.paragraph_format.space_after=Pt(2)
for text in ['Chief Executive Officer','JWC Contracting Ltd.','November 7, 2026']:
 p1=doc.add_paragraph(text);p1.paragraph_format.space_after=Pt(2)
doc.add_page_break();doc.add_heading('TABLE OF CONTENTS',0)
# Body pages are explicitly planned with conservative text metrics. Comparing the
# converted PDF's physical page count to this plan detects unplanned overflows.
blocks=re.split(r'^## (\d+\. .+)$',s,flags=re.M);sections=[]
for i in range(1,len(blocks),2):
 heading=blocks[i];body=blocks[i+1].strip();paras=[]
 for para in re.split(r'\n\s*\n',body):
  lines=para.splitlines()
  if lines and all(re.match(r'(- |\d+\. )',l) for l in lines):paras.extend(('bullet' if l.startswith('- ') else 'number',re.sub(r'^- ','',l)) for l in lines)
  else:paras.append(('normal',para.replace('  \n','\n')))
 sections.append((heading,paras))
measure=ImageFont.truetype('/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',42)
def line_count(text,width):
 text=re.sub(r'\*\*(.*?)\*\*',r'\1',text);total=0
 for hardline in text.split('\n'):
  current='';lines=1
  for word in hardline.split():
   probe=(current+' '+word).strip()
   if measure.getlength(probe)>width*4/1.1:
    if current:lines+=1;current=word
    else:lines+=max(0,math.ceil(measure.getlength(word)/(width*4/1.1))-1);current=''
   else:current=probe
  total+=lines
 return total
pages=[];starts={};page_no=4
for heading,paras in sections:
 starts[heading]=page_no;used=58;page=[];continuation=False
 for kind,text in paras:
  height=line_count(text,475 if kind!='normal' else 496)*14+9
  if used+height>605 and page:
   pages.append((heading,page,continuation));page_no+=1;page=[];used=58;continuation=True
  page.append((kind,text));used+=height
 pages.append((heading,page,continuation));page_no+=1
# Static page numbers, native internal bookmarks and a live page-number footer.
for n,(heading,_) in enumerate(sections,1):
 p1=doc.add_paragraph();p1.paragraph_format.space_after=Pt(6);p1.paragraph_format.line_spacing=Pt(14);p1.paragraph_format.tab_stops.add_tab_stop(Inches(6.8),WD_TAB_ALIGNMENT.RIGHT,WD_TAB_LEADER.DOTS)
 link=OxmlElement('w:hyperlink');link.set(qn('w:anchor'),'section_'+str(n));rr=OxmlElement('w:r');props=OxmlElement('w:rPr');fontx=OxmlElement('w:rFonts');fontx.set(qn('w:ascii'),'Arial');props.append(fontx);rr.append(props);tt=OxmlElement('w:t');tt.text=heading;rr.append(tt);link.append(rr);p1._p.append(link);p1.add_run('\t'+str(starts[heading]))
def add_runs(p1,text):
 for token in re.split(r'(\*\*.*?\*\*)',text):
  run=p1.add_run(token[2:-2] if token.startswith('**') else token);run.bold=token.startswith('**')
for heading,paras,cont in pages:
 doc.add_page_break();h=doc.add_heading(heading+(' (continued)' if cont else ''),1)
 if not cont:
  n=int(heading.split('.')[0]);a=OxmlElement('w:bookmarkStart');a.set(qn('w:id'),str(n));a.set(qn('w:name'),'section_'+str(n));z=OxmlElement('w:bookmarkEnd');z.set(qn('w:id'),str(n));h._p.insert(1 if h._p.pPr is not None else 0,a);h._p.append(z)
 for kind,text in paras:
  p1=doc.add_paragraph();p1.paragraph_format.widow_control=True
  if kind!='normal':p1.paragraph_format.left_indent=Inches(.18);p1.paragraph_format.first_line_indent=Inches(-.12);text=('• ' if kind=='bullet' else '')+text
  add_runs(p1,text)
doc.core_properties.title='JWC Contracting Ltd. — Health & Safety Manual';doc.core_properties.author='JWC Contracting Ltd.';doc.core_properties.subject='Alberta oilfield trucking and heavy hauling safety and carrier compliance';doc.core_properties.version='1.1';doc.save(out/'JWC-Safety-Program.docx')
(out/'handbook-pagination.json').write_text(json.dumps({'expected_pages':len(pages)+3,'section_pages':starts},indent=2))
print('DOCX authored:',len(pages)+3,'planned pages; cover 1, mission 2, contents 3, body 4 onward')
