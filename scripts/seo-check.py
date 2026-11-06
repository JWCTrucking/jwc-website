"""Check public search signals without changing copy or claiming search rankings."""
import json
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://www.jwchauling.com/'

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tags, self.text, self.json_scripts = [], [], []
        self.script, self.script_text = False, []
        self.skip = 0
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append((tag, attrs))
        if tag in ('script', 'style'):
            self.skip += 1
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.script, self.script_text = True, []
    def handle_endtag(self, tag):
        if tag == 'script' and self.script:
            self.json_scripts.append(json.loads(''.join(self.script_text)))
            self.script = False
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)
    def handle_data(self, data):
        if self.script:
            self.script_text.append(data)
        if not self.skip:
            self.text.append(data)

def require(condition, message):
    if not condition:
        raise ValueError(message)

try:
    page = Page((ROOT / 'index.html').read_text())
    text = ' '.join(page.text)
    canonicals = [a.get('href') for t, a in page.tags if t == 'link' and a.get('rel') == 'canonical']
    require(canonicals == [BASE], 'Homepage canonical must identify the HTTPS www domain')
    robots = [a.get('content', '').lower() for t, a in page.tags if t == 'meta' and a.get('name', '').lower() == 'robots']
    require(not any('noindex' in value or 'nosnippet' in value for value in robots), 'Public page blocks indexing or search snippets')
    robots_file = (ROOT / 'robots.txt').read_text()
    require(not re.search(r'^Disallow:\s*/\s*$', robots_file, re.M | re.I), 'robots.txt blocks the public website')
    require(BASE + 'sitemap.xml' in robots_file, 'Public sitemap is missing from robots.txt')
    require(sum(t == 'h1' for t, _ in page.tags) == 1, 'Homepage needs a single main heading')
    for term in ['JWC Contracting Ltd.', 'Peace River', 'Grande Prairie', 'Northern Alberta', 'heavy hauling', 'trucking', 'hot shot', '2019']:
        require(term.lower() in text.lower(), 'Missing visible business/service information: ' + term)
    nodes = [node for script in page.json_scripts for node in script.get('@graph', [script])]
    business = next((n for n in nodes if n.get('@type') == 'LocalBusiness'), None)
    require(business is not None, 'Missing local business structured data')
    require(business['url'] == BASE and business['address']['addressLocality'] == 'Peace River', 'Business URL/location mismatch')
    require(business['email'] in text, 'Business email is missing from visible page')
    hrefs = [a.get('href', '') for t, a in page.tags if t == 'a']
    require(any(h.startswith('tel:') and re.sub(r'\D', '', h[4:]) == re.sub(r'\D', '', business['telephone']) for h in hrefs), 'Schema telephone does not match the call link')
    require('mailto:' + business['email'] in hrefs, 'Schema email does not match the dispatch link')
    ids = {a['id'] for _, a in page.tags if 'id' in a}
    for offer in business['hasOfferCatalog']['itemListElement']:
        service = offer['itemOffered']
        require(urlsplit(service['url']).fragment in ids, 'Structured service URL has no visible section')
        require(service['provider']['@id'] == business['@id'], 'Service provider does not identify JWC')
        require(service.get('description', '') in text, 'Service description differs from visible content')
    for tag, attrs in page.tags:
        if tag == 'img':
            require(bool(attrs.get('alt', '').strip()), 'Public content image needs alternative text')
        for attr in ('href', 'src'):
            ref = attrs.get(attr, '')
            target = urlsplit(ref)
            if not ref or target.scheme or target.netloc:
                continue
            if not target.path:
                if target.fragment:
                    require(unquote(target.fragment) in ids, 'Broken homepage section link: ' + ref)
                continue
            path = ROOT / unquote(target.path).lstrip('/')
            if path.is_dir():
                path /= 'index.html'
            require(path.exists(), 'Broken local public-page link: ' + ref)
    for element in ET.parse(ROOT / 'sitemap.xml').getroot():
        loc = next(child.text for child in element if child.tag.endswith('loc'))
        require(loc.startswith(BASE), 'Sitemap uses a non-canonical domain')
        target = ROOT / urlsplit(loc).path.lstrip('/')
        if target.is_dir():
            target /= 'index.html'
        require(target.exists(), 'Sitemap points to a missing page')
        mapped = Page(target.read_text())
        require(not any(t == 'meta' and a.get('name') == 'robots' and 'noindex' in a.get('content', '') for t, a in mapped.tags), 'Sitemap lists a noindex page')
    print('PASS: crawl access, sitemap, canonical, visible service/location copy, business schema, contact consistency, images and public-page links.')
except Exception as error:
    print('SEO CHECK FAILED:', error, file=sys.stderr)
    sys.exit(1)
