// Themed hit counter for VibeCode2 (keeps original logic but scoped and modular)
const apiUrl = 'https://omcwjmvdjswkfjkahchm.supabase.co';
const headers = {
  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3dqbXZkanN3a2Zqa2FoY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDU1MDcsImV4cCI6MjA2NzAyMTUwN30.v-zypq4wN5EW0z8dxbUHWeNzDhuTylyL4chpBfTISxE',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3dqbXZkanN3a2Zqa2FoY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDU1MDcsImV4cCI6MjA2NzAyMTUwN30.v-zypq4wN5EW0z8dxbUHWeNzDhuTylyL4chpBfTISxE',
  'Content-Type': 'application/json'
};

// Use a page identifier for VibeCode2
const pagePath = 'VibeCode2';

function ensureCounterEl(){
  let el = document.getElementById('hit-counter');
  if(!el){
    el = document.createElement('div');
    el.id = 'hit-counter';
    el.className = 'hit-counter';
    el.innerHTML = `<span class="counter-label">Page Hits</span><span class="counter-value" id="hit-count">0</span><span class="error" id="hit-error" aria-hidden="true"></span>`;
    document.body.appendChild(el);
  }
  return el;
}

async function recordHit(){
  const el = ensureCounterEl();
  const hitCountEl = document.getElementById('hit-count');
  const hitErrorEl = document.getElementById('hit-error');
  hitErrorEl.style.display = 'none';
  hitErrorEl.textContent = '';

  try{
    const getResponse = await fetch(`${apiUrl}/rest/v1/page_hits?page_path=eq.${encodeURIComponent(pagePath)}&select=id,hit_count`,{
      method: 'GET', headers
    });
    if(getResponse.ok){
      const existing = await getResponse.json();
      if(existing.length>0){
        const record = existing[0];
        const newCount = (record.hit_count||0) + 1;
        const updateResponse = await fetch(`${apiUrl}/rest/v1/page_hits?id=eq.${record.id}`,{
          method:'PATCH', headers, body: JSON.stringify({ hit_count: newCount, last_hit: new Date().toISOString(), updated_at: new Date().toISOString() })
        });
        if(updateResponse.ok){
          hitCountEl.textContent = newCount.toLocaleString();
        }else{
          hitCountEl.textContent = (record.hit_count||0).toLocaleString();
          hitErrorEl.textContent = 'Could not update counter.'; hitErrorEl.style.display='block';
        }
      }else{
        const createResponse = await fetch(`${apiUrl}/rest/v1/page_hits`,{
          method:'POST', headers, body: JSON.stringify({ page_path: pagePath, hit_count: 1, first_hit: new Date().toISOString(), last_hit: new Date().toISOString(), last_ip_hash: 'browser-'+Math.random().toString(36).substring(7) })
        });
        if(createResponse.ok){ hitCountEl.textContent = '1'; }else{ hitCountEl.textContent = '---'; hitErrorEl.textContent = 'Could not create record.'; hitErrorEl.style.display='block'; }
      }
    }else{
      hitCountEl.textContent = '---'; hitErrorEl.textContent = 'API error.'; hitErrorEl.style.display='block';
    }
  }catch(err){
    console.warn('Hit counter error', err);
    const hitCountEl2 = document.getElementById('hit-count');
    if(hitCountEl2) hitCountEl2.textContent = '---';
    const hitErrorEl2 = document.getElementById('hit-error');
    if(hitErrorEl2){ hitErrorEl2.textContent = 'Network error.'; hitErrorEl2.style.display='block'; }
  }
}

// Run on load
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', recordHit);
} else recordHit();
