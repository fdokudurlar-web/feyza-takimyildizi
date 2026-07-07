# Yerel önizleme sunucusu — site kökünü 4173 portunda yayınlar.
# Kullanım: python3 scripts/serve.py
# (fetch ile JSON okuduğumuz için site file:// üzerinden değil,
#  bir HTTP sunucusundan açılmalı.)
import http.server
import os

ROOT = os.environ.get('SITE_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """Geliştirme sırasında tarayıcının eski dosyayı önbellekten
    sunmaması için no-store başlığı ekler."""
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()


http.server.ThreadingHTTPServer(('127.0.0.1', 4173), NoCacheHandler).serve_forever()
