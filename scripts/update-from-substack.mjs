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

/* Substack, Cloudflare bot koruması arkasında. GitHub Actions'ın
   veri merkezi IP'lerinden gelen "bot" görünümlü istekler 403 ile
   engellenebiliyor; bu yüzden gerçek bir tarayıcı User-Agent'ı ve
   birkaç kez tekrar deneme kullanıyoruz. */
const FETCH_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'accept': 'application/rss+xml, application/xml, text/xml, */*',
  'accept-language': 'tr-TR,tr;q=0.9,en;q=0.8'
};

async function fetchFeed(url, tries = 4){
  let lastErr = '';
  for(let i = 1; i <= tries; i++){
    try {
      const res = await fetch(url, { headers: FETCH_HEADERS });
      if(res.ok) return await res.text();
      lastErr = `HTTP ${res.status}`;
      /* 403/429/503 = Cloudflare engeli; kısa bekleyip tekrar dene */
      console.error(`RSS denemesi ${i}/${tries} başarısız: ${lastErr}`);
    } catch(e){
      lastErr = e.message;
      console.error(`RSS denemesi ${i}/${tries} hata: ${lastErr}`);
    }
    if(i < tries) await new Promise(r => setTimeout(r, i * 3000));
  }
  console.error(`RSS alınamadı (${tries} deneme): ${lastErr}`);
  process.exit(1);
}

const xml = await fetchFeed(FEED_URL);
const feedItems = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
console.log(`RSS'te ${feedItems.length} yazı bulundu.`);

let added = 0;
/* feed en-yeni-önce gelir; kronoloji bozulmasın diye ters çevirip sona ekliyoruz */
for(const block of feedItems.reverse()){
  const link = tag(block, 'link');
  const title = tag(block, 'title');
  if(!link || !title || known.has(link)) continue;
  const summary = tag(block, 'description').replace(/<[^>]+>/g, ' ');
  const pub = tag(block, 'pubDate');
  const date = pub ? new Date(pub).toISOString().slice(0, 10) : undefined;
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
