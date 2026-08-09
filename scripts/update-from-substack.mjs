/* =========================================================
   SUBSTACK SENKRONU — RSS'teki yeni yazıları yıldıza çevirir.

   Ne yapar:
   1. https://kimsebanasormadi.substack.com/feed adresini çeker.
   2. data/site-data.json'da OLMAYAN yazıları (link'e göre) bulur.
   3. Başlık + özet üzerinden anahtar kelimeyle tema tahmin eder,
      yeni yıldız olarak listenin SONUNA ekler (sona eklemek
      önemli: yıldız konumları dizideki indeksten türetildiği
      için mevcut yıldızlar yerinden oynamaz).
   4. Var olan yazılara ASLA dokunmaz — tema/journey alanlarını
      elle düzenlersen senkron bunları ezmez.

   Çalıştırmak: node scripts/update-from-substack.mjs
   (Node 18+ gerekir; GitHub Action'ı her gün otomatik çalıştırır.)

   Tema tahmini kabaca bir başlangıçtır: yeni yazı geldikten
   sonra JSON'daki themes / journey alanlarını elle inceltmek
   en doğru sonuç.
   ========================================================= */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FEED_URL = 'https://kimsebanasormadi.substack.com/feed';
const DATA_PATH = fileURLToPath(new URL('../data/site-data.json', import.meta.url));

/* tema tahmini için anahtar kelimeler — küçük harfle yazılır,
   başlık+özet küçük harfe çevrilip arama yapılır */
const THEME_KEYWORDS = {
  tek: ['yapay zek', ' ai ', 'ai\'', 'yz ', 'algoritma', 'teknoloji', 'chatgpt', 'llm', 'robot', 'otomasyon', 'dijital', 'yazılım', 'prompt', 'veri', 'internet'],
  ins: ['gen z', 'kuşak', 'toplum', 'insan', 'kültür', 'ofis', 'iş hayatı', 'sosyal', 'ilişki', 'psikoloji', 'şehir', 'gündelik', 'istifa'],
  eko: ['ekonomi', 'ücret', 'maaş', 'emek', 'eşitlik', 'işsizlik', 'para', 'enflasyon', 'gelir', 'sınıf', 'iş gücü'],
  tas: ['tasarım', 'estetik', 'mimari', 'mimarlık', 'moda', 'sanat', 'oran', 'güzellik']
};
const DEFAULT_THEMES = ['tek']; /* hiçbir kelime eşleşmezse */

function stripCdata(s){ return s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim(); }
function decodeEntities(s){
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
}
function tag(block, name){
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
  return m ? decodeEntities(stripCdata(m[1])) : '';
}

function guessThemes(text){
  const hay = ' ' + text.toLowerCase() + ' ';
  const hit = Object.entries(THEME_KEYWORDS)
    .filter(([, words]) => words.some(w => hay.includes(w)))
    .map(([id]) => id);
  /* yıldız geometrisi en fazla 2 temayla en iyi çalışıyor
     (2 tema = kenar üzerinde konum); ilk iki eşleşmeyi al */
  return hit.length ? hit.slice(0, 2) : [...DEFAULT_THEMES];
}

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
const known = new Set(data.items.map(it => it.link));

/* Substack, Cloudflare bot koruması arkasında ve GitHub Actions'ın
   veri merkezi IP'lerini — tarayıcı User-Agent'ı kullansak bile —
   IP itibarı yüzünden HTTP 403 ile engelliyor. (Ücretsiz CORS
   proxy'leri de artık ya kapalı ya anahtar istiyor.)

   Çözüm iki kaynaklı:
   1) DOĞRUDAN besleme (XML) — senin makinen gibi normal IP'lerde
      çalışır; hızlı ve bağımsızdır.
   2) rss2json — beslemeyi KENDİ sunucusundan çekip JSON döner.
      İstek Substack'e GitHub'ın IP'siyle gitmediği için Cloudflare
      engeli devreden çıkar; CI'da güvenilir çalışan yol budur.
   Her iki kaynak da tek tip {title, link, pubDate, summary}
   listesine normalize edilir. */
const FETCH_HEADERS = {
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'accept': 'application/rss+xml, application/xml, text/xml, application/json, */*',
  'accept-language': 'tr-TR,tr;q=0.9,en;q=0.8'
};

async function fetchText(url){
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

/* Kaynak 1 — doğrudan RSS (XML) */
async function fromDirect(){
  const xml = await fetchText(FEED_URL);
  if(!xml.includes('<item>')) throw new Error('RSS değil (muhtemel engel sayfası)');
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const b = m[1];
    return {
      title: tag(b, 'title'),
      link: tag(b, 'link'),
      pubDate: tag(b, 'pubDate'),
      summary: tag(b, 'description').replace(/<[^>]+>/g, ' ')
    };
  });
}

/* Kaynak 2 — rss2json (JSON); anahtar gerektirmez */
async function fromRss2json(){
  const url = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(FEED_URL);
  const j = JSON.parse(await fetchText(url));
  if(j.status !== 'ok' || !Array.isArray(j.items)) throw new Error(`rss2json status=${j.status}`);
  return j.items.map(it => ({
    title: decodeEntities(String(it.title || '')),
    link: String(it.link || it.guid || ''),
    pubDate: String(it.pubDate || ''),
    summary: decodeEntities(String(it.description || '')).replace(/<[^>]+>/g, ' ')
  }));
}

const SOURCES = [
  { name: 'doğrudan', get: fromDirect },
  { name: 'rss2json', get: fromRss2json }
];

async function getFeedItems(){
  let lastErr = '';
  for(const src of SOURCES){
    for(let i = 1; i <= 2; i++){       /* kaynak başına 2 deneme */
      try {
        const items = await src.get();
        if(items.length){
          console.log(`RSS alındı: ${src.name} (${items.length} yazı)`);
          return items;
        }
        lastErr = '0 öğe döndü';
      } catch(e){
        lastErr = e.message;
      }
      console.error(`  ${src.name} denemesi ${i}/2 başarısız: ${lastErr}`);
      if(i < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error(`RSS hiçbir kaynaktan alınamadı. Son hata: ${lastErr}`);
  process.exit(1);
}

/* iki kaynağın tarih biçimi farklı: doğrudan XML "Sun, 19 Jul 2026
   14:20:39 GMT", rss2json "2026-07-19 14:20:39". İkisini de çöz. */
function toDate(pub){
  if(!pub) return undefined;
  const d = new Date(/GMT|T|Z/.test(pub) ? pub : pub.replace(' ', 'T'));
  return isNaN(+d) ? undefined : d.toISOString().slice(0, 10);
}

const feedItems = await getFeedItems();

let added = 0;
/* feed en-yeni-önce gelir; kronoloji bozulmasın diye ters çevirip sona ekliyoruz */
for(const it of feedItems.reverse()){
  const { title, link, summary } = it;
  if(!link || !title || known.has(link)) continue;
  const date = toDate(it.pubDate);
  const item = {
    title,
    type: 'yazi',
    themes: guessThemes(title + ' ' + summary),
    link,
    source: 'substack'   /* elle eklenenlerden ayırt etmek için */
  };
  if(date) item.date = date;
  data.items.push(item);
  known.add(link);
  added++;
  console.log(`+ "${title}" → [${item.themes.join(', ')}]`);
}

if(added){
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`${added} yeni yıldız eklendi → ${DATA_PATH}`);
} else {
  console.log('Yeni yazı yok, dosya değişmedi.');
}
