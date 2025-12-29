// Hit counter using a single RPC call (`increment_page_hit`) to avoid GET/PUT races
const apiUrl = 'https://omcwjmvdjswkfjkahchm.supabase.co';
const headers = {
  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3dqbXZkanN3a2Zqa2FoY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDU1MDcsImV4cCI6MjA2NzAyMTUwN30.v-zypq4wN5EW0z8dxbUHWeNzDhuTylyL4chpBfTISxE',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3dqbXZkanN3a2Zqa2FoY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDU1MDcsImV4cCI6MjA2NzAyMTUwN30.v-zypq4wN5EW0z8dxbUHWeNzDhuTylyL4chpBfTISxE',
  'Content-Type': 'application/json'
};

// Record a hit using the RPC endpoint; returns the updated record (array or object)
async function recordHitRpc(pagePath, countElId){
  const hitCountEl = document.getElementById(countElId || 'hit-count');
  try{
    const resp = await fetch(`${apiUrl}/rest/v1/rpc/increment_page_hit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ page_path: pagePath, last_ip_hash: 'browser-' + Math.random().toString(36).substring(7) })
    });
    if(!resp.ok){ if(hitCountEl) hitCountEl.textContent = '---'; return; }
    const data = await resp.json();
    const rec = Array.isArray(data) ? data[0] : data;
    if(hitCountEl) hitCountEl.textContent = (rec && rec.hit_count != null) ? rec.hit_count.toLocaleString() : '---';
  }catch(err){
    console.warn('Hit counter RPC error', err);
    if(hitCountEl) hitCountEl.textContent = '---';
  }
}

// Auto-run for the default VibeCode2 page id
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ()=> recordHitRpc('VibeCode2', 'hit-count'));
} else {
  recordHitRpc('VibeCode2', 'hit-count');
}
