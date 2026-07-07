/* =========================================================
   GÖKYÜZÜ MOTORU — index.html
   VERİ MODELİ — sitenin tek gerçek kaynağı artık
   data/site-data.json dosyası.
   Yeni yıldız  = items dizisine bir satır (elle ya da
                  scripts/update-from-substack.mjs ile otomatik).
   Yeni düğüm   = themes sözlüğüne bir giriş.
   Düğüm boyutu içerik sayısından, kenar parlaklığı ortak
   içerikten, orbit halkaları güneşe uzaklıktan hesaplanır.
   ========================================================= */

const svgNS = 'http://www.w3.org/2000/svg';
const sky = document.getElementById('sky');
function el(tag, attrs, parent){
  const n = document.createElementNS(svgNS, tag);
  for(const k in attrs) n.setAttribute(k, attrs[k]);
  (parent||sky).appendChild(n); return n;
}
function hash(n){ n = (n*2654435761) % 4294967296; return Math.abs(n % 997); }
const motionOK = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

fetch('data/site-data.json')
  .then(r => r.json())
  .then(render)
  .catch(err => console.error('Veri yüklenemedi:', err));

function render(DATA){
const THEMES = DATA.themes;
const ITEMS = DATA.items;
const PLANNED_EDGES = DATA.plannedEdges;
const TYPE_LABEL = DATA.typeLabels;
const PORTALS = DATA.portals;

function countFor(id){ return ITEMS.filter(it=>it.themes.includes(id)).length; }
/* içerik sayısına göre boyut — karekök ölçek: fark hissedilir, ezici değil */
function hubSize(id){
  if(id==='bio') return {glow:78, core:16, mid:10.5, hot:5.5, spike:48};
  const c = Math.sqrt(countFor(id));
  return {glow:22+7*c, core:4.5+1.7*c, hot:2+0.7*c, spike:14+7.5*c};
}

/* ============ defs ============ */
const defs = el('defs',{});
Object.entries(THEMES).forEach(([id,t])=>{
  const g = el('radialGradient',{id:'glow-'+id}, defs);
  el('stop',{offset:'0%', 'stop-color':t.hex, 'stop-opacity':0.6}, g);
  el('stop',{offset:'100%', 'stop-color':t.hex, 'stop-opacity':0}, g);
});

/* ============ kenar ağırlıkları ============ */
const edgeCounts = {};
ITEMS.forEach(it=>{
  if(it.themes.length===2){
    const key = [...it.themes].sort().join('-');
    edgeCounts[key] = (edgeCounts[key]||0)+1;
  }
});

/* ============ dalgalı rota geometrisi (S-kıvrımlı kübik) ============ */
const B = THEMES.bio;
function lerp(a,b,t){ return {x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t}; }
const edgeCurves = {};
function curveFor(idA,idB){
  const key=[idA,idB].sort().join('-');
  if(!edgeCurves[key]){
    const [ka,kb]=key.split('-');
    const a=THEMES[ka], b=THEMES[kb];
    const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy);
    const nx=-dy/len, ny=dx/len;
    const seed = hash(key.length*31 + key.charCodeAt(0)*7 + key.charCodeAt(4)*13);
    const amp = len*(0.09 + (seed%7)/100);
    const s = (seed%2 ? 1 : -1);
    const p1=lerp(a,b,0.3), p2=lerp(a,b,0.7);
    edgeCurves[key]={a, b,
      c1:{x:p1.x+nx*amp*s, y:p1.y+ny*amp*s},
      c2:{x:p2.x-nx*amp*s, y:p2.y-ny*amp*s}};
  }
  return edgeCurves[key];
}
function cubicPoint(cv,t){
  const u=1-t;
  return {
    x: u*u*u*cv.a.x + 3*u*u*t*cv.c1.x + 3*u*t*t*cv.c2.x + t*t*t*cv.b.x,
    y: u*u*u*cv.a.y + 3*u*u*t*cv.c1.y + 3*u*t*t*cv.c2.y + t*t*t*cv.b.y
  };
}
function curveD(cv){
  return `M ${cv.a.x} ${cv.a.y} C ${cv.c1.x.toFixed(1)} ${cv.c1.y.toFixed(1)} ${cv.c2.x.toFixed(1)} ${cv.c2.y.toFixed(1)} ${cv.b.x} ${cv.b.y}`;
}

/* ============ katman 1: ortam yıldızları ============ */
const bgGroup = el('g',{});
for(let i=0;i<420;i++){
  const x = hash(i*7+1)%1000, y = hash(i*13+5)%700;
  const r = 0.4 + (hash(i*3+2)%11)/10;
  const o = 0.3 + (hash(i+9)%50)/100;
  const c = el('circle',{cx:x, cy:y, r:r, fill:'#FBF8EF', opacity:o, class:'twinkle'}, bgGroup);
  c.style.setProperty('--o', o);
  c.style.animationDelay = (hash(i*5+3)%34)/10 + 's';
}

/* ============ katman 2: orbit halkaları — her tema güneşin yörüngesinde ============ */
const orbitGroup = el('g',{});
Object.keys(THEMES).filter(k=>k!=='bio').forEach((k,i)=>{
  const t = THEMES[k];
  const dx=t.x-B.x, dy=t.y-B.y;
  const q = 0.55 + (hash(i*41+3)%20)/100;              /* eliptik basıklık, her orbit farklı */
  const rx = Math.hypot(dx, dy/q), ry = q*rx;
  const d = `M ${(B.x+rx).toFixed(1)} ${B.y} A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 1 ${(B.x-rx).toFixed(1)} ${B.y} A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 1 ${(B.x+rx).toFixed(1)} ${B.y}`;
  el('path',{d, fill:'none', stroke:'#F3EFE4', 'stroke-width':0.6, opacity:0.08}, orbitGroup);
  /* orbit üzerinde yavaşça süzülen ışıltı — hiçbir şeyi yerinden oynatmaz */
  if(motionOK){
    const spark = el('circle',{r:1.7, fill:t.hex, opacity:0.55}, orbitGroup);
    el('animateMotion',{dur:(48+i*14)+'s', repeatCount:'indefinite', path:d}, spark);
  }
});

/* ============ katman 3: tema–tema kenarları (dalgalı, renk geçişli) ============ */
const edgeGroup = el('g',{});
function edgeGradient(key, a, b){
  const g = el('linearGradient',{id:'eg-'+key, gradientUnits:'userSpaceOnUse',
    x1:a.x, y1:a.y, x2:b.x, y2:b.y}, defs);
  el('stop',{offset:'0%','stop-color':a.hex}, g);
  el('stop',{offset:'100%','stop-color':b.hex}, g);
  return 'url(#eg-'+key+')';
}
Object.keys(edgeCounts).forEach(key=>{
  const cv = curveFor(...key.split('-'));
  const d = curveD(cv);
  const stroke = edgeGradient(key, cv.a, cv.b);
  /* tüm kenarlar eşit incelikte — parlaklık farkı yok */
  el('path',{d, fill:'none', stroke, 'stroke-width':1, opacity:0.32, 'stroke-linecap':'round', class:'edge'}, edgeGroup);
});
/* planlanan kenarlar: soluk, kesikli — içerik gelince kendiliğinden parlar */
PLANNED_EDGES.forEach(([ka,kb])=>{
  const key=[ka,kb].sort().join('-');
  if(edgeCounts[key]) return;
  const cv = curveFor(ka,kb);
  el('path',{d:curveD(cv), fill:'none', stroke:'#F3EFE4', 'stroke-width':0.8, opacity:0.13,
     'stroke-dasharray':'3 8', 'stroke-linecap':'round', class:'edge breathe'}, edgeGroup);
  const mid = cubicPoint(cv, 0.5);
  el('text',{class:'hub-sub', x:mid.x, y:mid.y+16, 'text-anchor':'middle', opacity:0.55}, edgeGroup).textContent = 'yakında';
});

/* ============ yıldız konumlandırma ============ */
function itemPos(item, i){
  if(item.themes.length===2){
    const cv = curveFor(item.themes[0], item.themes[1]);
    const t = 0.3 + (hash(i*11+4)%41)/100;
    const p = cubicPoint(cv, t);
    const dx=cv.b.x-cv.a.x, dy=cv.b.y-cv.a.y, len=Math.hypot(dx,dy);
    const off = (hash(i*17+6)%2 ? 1 : -1) * (9 + hash(i*23+8)%13);
    return { x:p.x + (-dy/len)*off, y:p.y + (dx/len)*off };
  }
  if(item.themes.length>2){
    let x=0,y=0;
    item.themes.forEach(th=>{ x+=THEMES[th].x; y+=THEMES[th].y; });
    x/=item.themes.length; y/=item.themes.length;
    return { x:x+(hash(i*19)%40)-20, y:y+(hash(i*27)%40)-20 };
  }
  const h = THEMES[item.themes[0]];
  const ang = (hash(i*29+2)%628)/100;
  const r = hubSize(item.themes[0]).glow + 22 + hash(i*31+7)%52;
  return {
    x: Math.min(950, Math.max(40, h.x + Math.cos(ang)*r)),
    y: Math.min(645, Math.max(60, h.y + Math.sin(ang)*r*0.85))
  };
}
ITEMS.forEach((it,i)=> it.pos = itemPos(it,i));

/* ============ katman 4: AI Journey yolu ============ */
const journeyItems = ITEMS.filter(it=>it.journey);
function smoothPath(pts){
  if(pts.length<2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for(let i=1;i<pts.length-1;i++){
    const mx=(pts[i].x+pts[i+1].x)/2, my=(pts[i].y+pts[i+1].y)/2;
    d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const L = pts[pts.length-1];
  d += ` L ${L.x.toFixed(1)} ${L.y.toFixed(1)}`;
  return d;
}
const journeyPath = el('path',{d:smoothPath(journeyItems.map(it=>it.pos)), fill:'none',
  stroke:'#F7C873', 'stroke-width':1.4, opacity:0, class:'journey-path'});

/* ============ katman 5: çok temalı iplikler ============ */
const threadGroup = el('g',{});
ITEMS.forEach((it,i)=>{
  if(it.themes.length<2) return;
  it.threads = it.themes.map(th=>{
    const h = THEMES[th];
    const dx=h.x-it.pos.x, dy=h.y-it.pos.y, len=Math.hypot(dx,dy)||1;
    const c = {x:(it.pos.x+h.x)/2 - dy/len*len*0.1, y:(it.pos.y+h.y)/2 + dx/len*len*0.1};
    return el('path',{d:`M ${it.pos.x} ${it.pos.y} Q ${c.x.toFixed(1)} ${c.y.toFixed(1)} ${h.x} ${h.y}`, fill:'none',
      stroke:h.hex, 'stroke-width':0.7, opacity:0.15, 'stroke-dasharray':'1.5 4',
      class:'thread', 'data-idx':i}, threadGroup);
  });
});

/* ============ katman 6: içerik yıldızları ============ */
const shapes = {
  yazi:  (x,y,f)=> el('path',{d:`M ${x} ${y-6} L ${x+1.8} ${y-1.8} L ${x+6} ${y} L ${x+1.8} ${y+1.8} L ${x} ${y+6} L ${x-1.8} ${y+1.8} L ${x-6} ${y} L ${x-1.8} ${y-1.8} Z`, fill:f}),
  kitap: (x,y,f)=> el('circle',{cx:x, cy:y, r:4, fill:'none', stroke:f, 'stroke-width':1.5}),
  film:  (x,y,f)=> el('path',{d:`M ${x} ${y-5} L ${x+4.6} ${y+3.4} L ${x-4.6} ${y+3.4} Z`, fill:f}),
  secki: (x,y,f)=> el('path',{d:`M ${x-4.4} ${y-4.4} L ${x+4.4} ${y+4.4} M ${x+4.4} ${y-4.4} L ${x-4.4} ${y+4.4}`, fill:'none', stroke:f, 'stroke-width':1.8, 'stroke-linecap':'round'})
};
const tip = document.getElementById('tip');
const starGroup = el('g',{});
ITEMS.forEach((it,i)=>{
  let fill = THEMES[it.themes[0]].hex;
  if(it.themes.length>=2){
    const g = el('linearGradient',{id:'ig-'+i, x1:'0%', y1:'0%', x2:'100%', y2:'100%'}, defs);
    it.themes.forEach((th,k)=>{
      el('stop',{offset:(k/(it.themes.length-1))*100+'%', 'stop-color':THEMES[th].hex}, g);
    });
    fill = 'url(#ig-'+i+')';
  }
  const g = el('g',{class:'item-star', 'data-idx':i, tabindex:'0', role:'button', 'aria-label':it.title}, starGroup);
  el('circle',{cx:it.pos.x, cy:it.pos.y, r:11, fill:fill, opacity:0.16}, g);
  g.appendChild(shapes[it.type](it.pos.x, it.pos.y, fill));
  g.addEventListener('mousemove', e=>{
    tip.innerHTML = `<div class="tt-type">${TYPE_LABEL[it.type]} · ${it.themes.map(t=>THEMES[t].name).join(' + ')}</div>${it.title}`;
    tip.style.opacity = 1;
    tip.style.left = Math.min(window.innerWidth-270, e.clientX+16)+'px';
    tip.style.top = (e.clientY+14)+'px';
  });
  g.addEventListener('mouseenter', ()=> setThreads(i, true));
  g.addEventListener('mouseleave', ()=>{ tip.style.opacity = 0; setThreads(i, false); });
  g.addEventListener('focus', ()=> setThreads(i, true));
  g.addEventListener('blur', ()=> setThreads(i, false));
  const open = ()=> openTheme(it.themes[0], it.title);
  g.addEventListener('click', open);
  g.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault(); open();} });
});
function setThreads(idx, on){
  (ITEMS[idx].threads||[]).forEach(t=>{
    t.setAttribute('opacity', on ? 0.8 : 0.15);
    t.setAttribute('stroke-width', on ? 1.2 : 0.7);
  });
}

/* ============ katman 7: tema düğümleri — boyut = içerik sayısı ============ */
function spikePair(x, y, L, w, hex, op, parent, rot){
  const g = el('g', rot ? {transform:`rotate(${rot} ${x} ${y})`} : {}, parent);
  el('path',{d:`M ${x} ${y-L} L ${x+w} ${y} L ${x} ${y+L} L ${x-w} ${y} Z`, fill:hex, opacity:op}, g);
  el('path',{d:`M ${x-L} ${y} L ${x} ${y-w} L ${x+L} ${y} L ${x} ${y+w} Z`, fill:hex, opacity:op}, g);
}
Object.entries(THEMES).forEach(([id,t])=>{
  const isBio = id==='bio';
  const S = hubSize(id);
  const g = el('g',{class:'hub', tabindex:'0', role:'button', 'aria-label':t.name});
  el('circle',{class:'halo '+(isBio?'sunbreathe':'pulse'), cx:t.x, cy:t.y, r:S.glow, fill:'url(#glow-'+id+')', opacity:isBio?0.8:0.75}, g);
  if(isBio){
    /* güneş: 8 sarı kanat + geniş turuncu göbek */
    spikePair(t.x, t.y, S.spike, 2.6, t.ray, 0.65, g);
    spikePair(t.x, t.y, S.spike*0.62, 2.2, t.ray, 0.5, g, 45);
    el('circle',{class:'core', cx:t.x, cy:t.y, r:S.core, fill:t.hex}, g);
    el('circle',{cx:t.x, cy:t.y, r:S.mid, fill:'#FFC24B'}, g);
    el('circle',{cx:t.x, cy:t.y, r:S.hot, fill:t.hot, opacity:0.95}, g);
  } else {
    spikePair(t.x, t.y, S.spike, 1.8, t.hex, 0.5, g);
    el('circle',{class:'core', cx:t.x, cy:t.y, r:S.core, fill:t.hex}, g);
    el('circle',{cx:t.x, cy:t.y, r:S.hot, fill:t.hot, opacity:0.95}, g);
  }
  const above = t.y < 340;
  const ly = above ? t.y - (S.glow + 16) : t.y + S.glow + 26;
  el('text',{class:'hub-label', x:t.x, y:ly, 'text-anchor':'middle'}, g).textContent = t.name;
  el('text',{class:'hub-sub', x:t.x, y:ly + (above?-20:18), 'text-anchor':'middle'}, g).textContent =
    isBio ? 'bio · portallar' : countFor(id)+' yıldız';
  const open = ()=> openTheme(id);
  g.addEventListener('click', open);
  g.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault(); open();} });
});

/* ============ panel ============ */
const panel = document.getElementById('panel');
const pEyebrow = document.getElementById('panelEyebrow');
const pTitle = document.getElementById('panelTitle');
const pDesc = document.getElementById('panelDesc');
const pBody = document.getElementById('panelBody');
const pPageLink = document.getElementById('panelPageLink');

function itemDateLabel(it){
  if(!it.date) return '';
  const d = new Date(it.date);
  if(isNaN(d)) return '';
  return ' · ' + d.toLocaleDateString('tr-TR', {month:'long', year:'numeric'});
}

function openTheme(id, highlightTitle){
  const t = THEMES[id];
  pEyebrow.innerHTML = `<span class="dot" style="background:${t.hex}"></span> ${id==='bio' ? 'merkez yıldız' : 'tema yıldızı'}`;
  pTitle.textContent = t.name;
  pDesc.textContent = t.desc;
  pBody.innerHTML = '';
  /* tema düğümlerinin kendi sayfası var — panelden oraya köprü */
  if(id==='bio'){
    pPageLink.style.display = 'none';
  } else {
    pPageLink.style.display = 'inline-block';
    pPageLink.href = 'tema/'+id+'.html';
  }
  if(id==='bio'){
    const wrap = document.createElement('div');
    wrap.className = 'bio-links';
    PORTALS.forEach(p=>{
      const a = document.createElement('a');
      a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
      a.innerHTML = `${p.label} <small>${p.sub} ↗</small>`;
      wrap.appendChild(a);
    });
    pBody.appendChild(wrap);
  } else {
    ITEMS.filter(it=>it.themes.includes(id)).forEach(it=>{
      const a = document.createElement('a');
      a.className = 'item-card'; a.href = it.link;
      if(it.link && it.link!=='#'){ a.target='_blank'; a.rel='noopener'; }
      if(highlightTitle && it.title===highlightTitle) a.style.borderColor = t.hex;
      const others = it.themes.filter(th=>th!==id);
      a.innerHTML = `<div class="ic-type">${TYPE_LABEL[it.type]}${it.journey ? ' · ✦ AI Journey' : ''}${itemDateLabel(it)}</div>
        <div class="ic-title">${it.title}</div>
        <div class="ic-themes">${it.themes.map(th=>`<span style="background:${THEMES[th].hex}" title="${THEMES[th].name}"></span>`).join('')}
        ${others.length ? `<small>ayrıca: ${others.map(th=>THEMES[th].name).join(', ')}</small>` : ''}</div>`;
      pBody.appendChild(a);
    });
  }
  panel.classList.add('open');
  panel.setAttribute('aria-hidden','false');
  dimTo(id);
}
document.getElementById('panelClose').addEventListener('click', closePanel);
function closePanel(){
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden','true');
  if(!journeyOn) undim();
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closePanel(); if(journeyOn) toggleJourney(); } });

/* ============ süzme / soluklaştırma ============ */
function dimTo(id){
  document.querySelectorAll('.item-star').forEach(s=>{
    const it = ITEMS[+s.dataset.idx];
    const off = id!=='bio' && !it.themes.includes(id);
    s.classList.toggle('dimmed', off);
    (it.threads||[]).forEach(t=> t.setAttribute('opacity', off ? 0 : 0.15));
  });
}
function undim(){
  document.querySelectorAll('.item-star').forEach(s=>{
    s.classList.remove('dimmed');
    (ITEMS[+s.dataset.idx].threads||[]).forEach(t=> t.setAttribute('opacity', 0.15));
  });
}

/* ============ AI Journey ============ */
let journeyOn = false;
const jBtn = document.getElementById('journeyBtn');
jBtn.addEventListener('click', toggleJourney);
function toggleJourney(){
  journeyOn = !journeyOn;
  jBtn.classList.toggle('active', journeyOn);
  jBtn.setAttribute('aria-pressed', journeyOn);
  journeyPath.setAttribute('opacity', journeyOn ? 0.75 : 0);
  document.querySelectorAll('.item-star').forEach(s=>{
    const it = ITEMS[+s.dataset.idx];
    const off = journeyOn && !it.journey;
    s.classList.toggle('dimmed', off);
    (it.threads||[]).forEach(t=> t.setAttribute('opacity', off ? 0 : 0.15));
  });
  if(journeyOn){
    pEyebrow.innerHTML = `<span class="dot" style="background:#F7C873"></span> yol · yıldız kümesi çizgisi`;
    pTitle.textContent = 'AI Journey';
    pDesc.textContent = 'Yapay zekâyla yazdığım, okuduğum ve denediğim her şeyi birbirine bağlayan yol — profesyonel ve kişisel deneyimlerim, kronolojik bir hikâye olarak.';
    pPageLink.style.display = 'none';
    pBody.innerHTML = '';
    journeyItems.forEach((it,i)=>{
      const a = document.createElement('a');
      a.className = 'item-card'; a.href = it.link;
      if(it.link && it.link!=='#'){ a.target='_blank'; a.rel='noopener'; }
      a.innerHTML = `<div class="ic-type">${String(i+1).padStart(2,'0')} · ${TYPE_LABEL[it.type]}</div>
        <div class="ic-title">${it.title}</div>`;
      pBody.appendChild(a);
    });
    panel.classList.add('open'); panel.setAttribute('aria-hidden','false');
  } else { closePanel(); undim(); }
}

/* ============ gösterge ============ */
const legend = document.getElementById('legend');
const legendShapes = {
  yazi:'<svg viewBox="-7 -7 14 14"><path d="M0-6 1.8-1.8 6 0 1.8 1.8 0 6 -1.8 1.8 -6 0 -1.8-1.8Z" fill="#F3EFE4"/></svg>',
  kitap:'<svg viewBox="-7 -7 14 14"><circle r="4" fill="none" stroke="#F3EFE4" stroke-width="1.5"/></svg>',
  film:'<svg viewBox="-7 -7 14 14"><path d="M0-5 4.6 3.4 -4.6 3.4Z" fill="#F3EFE4"/></svg>',
  secki:'<svg viewBox="-7 -7 14 14"><path d="M-4.4-4.4 4.4 4.4 M4.4-4.4 -4.4 4.4" stroke="#F3EFE4" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>'
};
Object.entries(TYPE_LABEL).forEach(([k,v])=>{
  legend.innerHTML += `<span>${legendShapes[k]} ${v.toLowerCase()}</span>`;
});
} /* render sonu */
