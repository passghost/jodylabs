import { initVibe } from './eye.js';

async function loadComponentText(path){
  const res = await fetch(path);
  if(!res.ok) throw new Error(`fetch ${path} ${res.status}`);
  return res.text();
}

(async function boot(){
  try{
    const headerHtml = await loadComponentText('components/header.html');
    document.querySelector('#header-placeholder').innerHTML = headerHtml;
  }catch(e){
    console.warn('Failed loading header', e);
  }

  // append a project card for Community Garden inside the header element
  try{
    const cardHtml = await loadComponentText('components/project-card.html');
    const headerEl = document.querySelector('#header-placeholder header');
    if(headerEl) headerEl.insertAdjacentHTML('beforeend', cardHtml);
    else {
      // fallback: append to placeholder
      const holder = document.querySelector('#header-placeholder');
      if(holder) holder.insertAdjacentHTML('beforeend', cardHtml);
    }
  }catch(e){
    console.warn('Failed loading project card', e);
  }

  const stage = document.getElementById('stage');
  initVibe(stage);
})();
