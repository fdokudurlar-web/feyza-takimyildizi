/* =========================================================
   TEMA SAYFASI MOTORU — tema/<id>.html tarafından kullanılır.
   Sayfa hangi temaya ait olduğunu <body data-theme="..."> ile
   bildirir; içerik data/site-data.json'dan okunur.
   Yeni bir tema eklerken: JSON'a girişi ekle + tema/ altına
   mevcut stub'lardan birini kopyalayıp data-theme'i değiştir.
   ========================================================= */
const themeId = document.body.dataset.theme;
const main = document.getElementById('main');

fetch('../data/site-data.json')
  .then(r => r.json())
  .then(render)
  .catch(err => console.error('Veri yüklenemedi:', err));

function render(DATA){
  const THEMES = DATA.themes;
  const TYPE_LABEL = DATA.typeLabels;
  const t = THEMES[themeId];
  if(!t){ main.textContent = 'Tema bulunamadı.'; return; }

  document.title = t.name + ' · Feyza D. Okudurlar';

  const items = DATA.items.filter(it => it.themes.includes(themeId));

  const dateLabel = it => {
    if(!it.date) return '';
    const d = new Date(it.date);
    return isNaN(d) ? '' : ' · ' + d.toLocaleDateString('tr-TR', {month:'long', year:'numeric'});
  };

  const cards = items.map(it => {
    const others = it.themes.filter(th => th !== themeId);
    const ext = it.link && it.link !== '#' ? ' target="_blank" rel="noopener"' : '';
    return `<a class="item-card" href="${it.link}"${ext}>
      <div class="ic-type">${TYPE_LABEL[it.type]}${it.journey ? ' · ✦ AI Journey' : ''}${dateLabel(it)}</div>
      <div class="ic-title">${it.title}</div>
      <div class="ic-themes">${it.themes.map(th=>`<span style="background:${THEMES[th].hex}" title="${THEMES[th].name}"></span>`).join('')}
      ${others.length ? `<small>ayrıca: ${others.map(th=>THEMES[th].name).join(', ')}</small>` : ''}</div>
    </a>`;
  }).join('');

  /* diğer temalara yatay geçiş köprüleri */
  const otherThemes = Object.entries(THEMES)
    .filter(([id]) => id !== themeId && id !== 'bio')
    .map(([id, th]) => `<a href="${id}.html"><i style="background:${th.hex}"></i>${th.name}</a>`)
    .join('');

  main.innerHTML = `
    <div class="tp-eyebrow"><span class="dot" style="background:${t.hex}"></span> tema yıldızı</div>
    <h2>${t.name}</h2>
    <p class="tp-desc">${t.desc}</p>
    <div class="tp-count">${items.length} yıldız</div>
    ${cards || '<p class="tp-desc">Bu temada henüz içerik yok — yakında.</p>'}
    <div class="tp-other-themes">${otherThemes}</div>
    <a class="tp-back" href="../index.html">← yıldız kümesine dön</a>`;
}
