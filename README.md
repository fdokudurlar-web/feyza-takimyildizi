# Feyza D. Okudurlar · Yıldız Kümesi

Kişisel site: düşüncelerimin gökyüzü. Yazılar, kitaplar, filmler ve seçkiler
temalara bağlı yıldızlar olarak interaktif bir haritada gösterilir.

## Dosya yapısı

```
index.html                        gökyüzü (ana sayfa)
tema/tek.html, ins, eko, tas      tema sayfaları
assets/style.css                  ortak stil
assets/sky.js                     gökyüzü motoru (veri modeli açıklamaları burada)
assets/theme-page.js              tema sayfası motoru
data/site-data.json               TEK GERÇEK KAYNAK: temalar, yıldızlar, portallar
scripts/update-from-substack.mjs  Substack RSS → yeni yıldız (Node 18+)
scripts/serve.py                  yerel önizleme sunucusu
.github/workflows/substack-sync.yml  günlük otomatik senkron
feyza-takimyildizi-v4.html        eski tek-dosya prototip (referans)
```

## İçerik ekleme / düzenleme

Her şey `data/site-data.json` içinde:

- **Yeni yıldız** → `items` dizisine bir giriş. `type`: `yazi | kitap | film | secki`,
  `themes`: 1–2 tema kimliği (2 tema = yıldız o iki tema arasındaki kenara oturur),
  `journey: true` → ✦ AI Journey yoluna dahil olur.
- **Yeni tema** → `themes` sözlüğüne giriş **+** `tema/` altına mevcut bir
  stub'ı kopyalayıp `data-theme` ve `<title>`'ı değiştir.
- Substack senkronunun eklediği yazılarda `source: "substack"` bulunur;
  tema tahmini kabadır — `themes` ve `journey` alanlarını elle düzeltebilirsin,
  senkron mevcut girişlere bir daha dokunmaz (yazılar linke göre eşleşir).

## Substack senkronu

`scripts/update-from-substack.mjs` RSS'i (`kimsebanasormadi.substack.com/feed`)
çeker, sitede olmayan yazıları anahtar kelimeyle temalandırıp `items` sonuna
ekler. GitHub Action'ı (`substack-sync.yml`) bunu her gün 09:30'da (TR) çalıştırır
ve değişiklik varsa commit'ler; commit de Vercel/GitHub Pages'i tetikleyip siteyi
günceller. Elle tetikleme: GitHub → Actions → "Substack senkronu" → Run workflow.

## Yerel önizleme

Site JSON'u `fetch` ile okuduğu için `file://` üzerinden açılmaz; sunucu gerekir:

```
python3 scripts/serve.py     # sonra http://localhost:4173
```

## Yayınlama

### 1. GitHub deposu (her iki yol için de gerekli)

```
git init
git add .
git commit -m "İlk sürüm"
```

GitHub'da `feyza-takimyildizi` adında boş bir depo aç, sonra:

```
git remote add origin https://github.com/<kullanici>/feyza-takimyildizi.git
git branch -M main
git push -u origin main
```

### 2a. Vercel (önerilen)

1. vercel.com → GitHub ile giriş → **Add New → Project** → bu depoyu seç.
2. Framework: **Other**, build komutu yok, output dizini yok (statik). **Deploy**.
3. Alan adı: Project → **Settings → Domains** → alan adını ekle.
   DNS sağlayıcında: kök alan için `A` kaydı → `76.76.21.21`,
   `www` için `CNAME` → `cname.vercel-dns.com`. (Vercel panelde tam değerleri gösterir.)

### 2b. GitHub Pages

1. Depo → **Settings → Pages** → Source: `Deploy from a branch`, Branch: `main` / `(root)`.
2. Alan adı: aynı sayfada **Custom domain** alanına yaz (bu, depoya `CNAME`
   dosyası ekler). DNS'te: `www` için `CNAME` → `<kullanici>.github.io`,
   kök alan için `A` kayıtları → `185.199.108.153`, `.109.153`, `.110.153`, `.111.153`.
3. "Enforce HTTPS" kutusunu işaretle (sertifika birkaç dakikada hazırlanır).

> Not: GitHub Pages'te senkron Action'ının push'u siteyi otomatik günceller.
> Vercel'de de her push yeni deploy demektir — ek ayar gerekmez.
