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
   veri merkezi IP'lerinden gelen istekler — tarayıcı User-Agent'ı
   kullansak bile — IP itibarı yüzünden 403 ile engelleniyor.
   Çözüm: beslemeyi önce doğrudan dene; olmazsa sunucu-taraflı
   proxy'ler üzerinden çek. Proxy, Substack'e kendi IP'sinden
   gittiği için GitHub'ın engellenen IP'si devreden çıkar. */
const FETCH_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'accept': 'application/rss+xml, application/xml, text/xml, */*',
  'accept-language': 'tr-TR,tr;q=0.9,en;q=0.8'
};

/* Sırayla denenecek kaynaklar: doğrudan + birkaç ücretsiz proxy.
   Biri düşer/engellenirse bir sonraki denenir. */
const SOURCES = [
  { name: 'doğrudan',   url: FEED_URL },
  { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent(FEED_URL) },
  { name: 'corsproxy',  url: 'https://corsproxy.io/?url=' + encodeURIComponent(FEED_URL) },
  { name: 'jina',       url: 'https://r.jina.ai/' + FEED_URL }
];

/* Gerçekten RSS mi aldık, yoksa Cloudflare engel sayfası mı? */
function looksLikeFeed(txt){ return typeof txt === 'string' && txt.includes('<item>'); }

async function fetchOnce(url){
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function fetchFeed(){
  let lastErr = '';
  for(const src of SOURCES){
    for(let i = 1; i <= 2; i++){       /* kaynak başına 2 deneme */
      try {
        const txt = await fetchOnce(src.url);
        if(looksLikeFeed(txt)){
          console.log(`RSS alındı: ${src.name}`);
          return txt;
        }
        lastErr = 'geçersiz içerik (RSS değil)';
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

const xml = await fetchFeed();
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
