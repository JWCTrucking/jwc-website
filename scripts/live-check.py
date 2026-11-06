"""Read-only production availability checks. Never submit a ticket or touch accounting."""
import sys
import urllib.request

BASE = 'https://www.jwchauling.com'
GOOGLE = 'https://script.google.com/macros/s/AKfycbxow0m-w5V3EntTTTdUQ6K2gQnUlPUaMWI_8qb3CrqeOZL5PcTqMjMsvWgmULSg-qDQqg/exec'
checks = [
    (BASE + '/', 'JWC Contracting Ltd.'),
    (BASE + '/app/', 'JWC Field App'),
    (BASE + '/app/forms.html', 'maintenance-form'),
    (BASE + '/app/ids.js?v=safari2', 'getRandomValues'),
    (BASE + '/app/staff-access.js?v=safari2', 'staff-pin-overlay'),
    (BASE + '/app/forms.js?v=safari2', 'unlockForm'),
    (BASE + '/robots.txt', 'Sitemap:'),
    (BASE + '/sitemap.xml', BASE + '/'),
    (GOOGLE, 'JWC Field App'),
]
failed = 0
for url, expected in checks:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'JWC-Website-Health-Check/1.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            if not response.url.startswith('https://'):
                raise ValueError('HTTPS redirected to an insecure URL')
            body = response.read(4_000_000).decode('utf-8')
            if response.status != 200 or expected not in body:
                raise ValueError('Expected public page content was not returned (check deployment or sign-in restrictions)')
        print('PASS:', url)
    except Exception as error:
        failed += 1
        print('FAIL:', url, str(error), file=sys.stderr)
sys.exit(1 if failed else 0)
