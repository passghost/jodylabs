// Simple HTML-escape utility for text inserted into innerHTML
function escapeHtml(str){
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Fallback boot that loads minimal modular components if fetching original fails
async function fallbackBoot(){
  async function loadComponentText(path){
    const res = await fetch(path);
    if(!res.ok) throw new Error(`fetch ${path} ${res.status}`);
    return res.text();
  }

  try{
    const headerHtml = await loadComponentText('components/header.html');
    document.querySelector('#header-placeholder').innerHTML = headerHtml;
  }catch(e){
    console.warn('Failed loading header', e);
  }

  // append a project card and extra community card
  try{
    const cardHtml = await loadComponentText('components/project-card.html');
    const holder = document.querySelector('#project-cards') || document.querySelector('#header-placeholder') || document.body;
    holder.insertAdjacentHTML('beforeend', cardHtml);
  }catch(e){ console.warn('Failed project-card', e); }

  const stage = document.getElementById('stage');
}

// Render helper: accept an array of project objects and build the grid
import { initVibe } from './eye.js';

function renderProjectsFromArray(arr){
  const stage = document.getElementById('stage');
  if(!stage) return false;
  stage.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'projects-grid';

  for(const item of arr){
    const title = item.title || '';
    const desc = item.desc || '';
    const href = item.href || '#';
    const icon = item.icon || '';
    let screenshot = (item.screenshots && item.screenshots[0]) || '../screenshots/placeholder.png';
    const card = document.createElement('div');
    card.className = 'project';
    card.innerHTML = `\
      <div class="project-content">\
        <div class="project-icon">${icon ? `<img src="${icon}" loading="lazy" alt="icon" />` : ''}</div>\
        <div class="project-body">\
          <h2>${escapeHtml(title)}</h2>\
          <p>${escapeHtml(desc)}</p>\
        </div>\
      </div>\
      ${screenshot ? `<img src="${screenshot}" class="project-screenshot" loading="lazy" alt="screenshot" />` : ''}\
      <a href="${href}" class="project-link"><span>→</span></a>`;

    grid.appendChild(card);
  }

  stage.appendChild(grid);
  // initialize animated background canvas (vibe)
  try{
    // stop previous if any
    if(stage.__vibe && typeof stage.__vibe.stop === 'function') stage.__vibe.stop();
    const vibe = initVibe(stage);
    if(vibe && typeof vibe.stop === 'function') stage.__vibe = vibe;
  }catch(e){console.warn('initVibe failed', e)}

  // after rendering, wire up search/filter if the control exists
  setTimeout(()=>{
    const search = document.getElementById('project-search');
    const countEl = document.getElementById('project-count');
    if(!search) return;
    const cards = Array.from(grid.querySelectorAll('.project'));
    function updateCount(){ if(countEl) countEl.textContent = String(cards.filter(c=>c.offsetParent!==null).length); }

    function doFilter(){
      const q = search.value.trim().toLowerCase();
      cards.forEach(card=>{
        const title = (card.querySelector('h2')?.textContent||'').toLowerCase();
        const desc = (card.querySelector('p')?.textContent||'').toLowerCase();
        const show = !q || title.includes(q) || desc.includes(q);
        card.style.display = show ? '' : 'none';
      });
      updateCount();
    }

    search.addEventListener('input', doFilter);
    // initial count
    updateCount();
  }, 50);
  return true;
}

(async function boot(){
  // Always load header component first so title/search are visible
  try{
    const resHead = await fetch('components/header.html');
    if(resHead && resHead.ok){
      const headerHtml = await resHead.text();
      const ph = document.querySelector('#header-placeholder');
      if(ph) ph.innerHTML = headerHtml;
    }
  }catch(e){ /* ignore header load errors, fallbackBoot will attempt again */ }

  // 1) Try local projects.json
  try{
    const res = await fetch('components/projects.json');
    if(res.ok){
      const json = await res.json();
      if(Array.isArray(json) && json.length){
        const ok = renderProjectsFromArray(json);
        if(ok) return;
      }
    }
  }catch(e){/* continue to next fallback */}

  // Final fallback: component-based minimal boot (no particle effects)
  await fallbackBoot();
})();
