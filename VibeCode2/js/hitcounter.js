// Hit counter utility: prefers meta-driven Supabase config, falls back to built-in values
const FALLBACK_API_URL = 'https://omcwjmvdjswkfjkahchm.supabase.co';
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3dqbXZkanN3a2Zqa2FoY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDU1MDcsImV4cCI6MjA2NzAyMTUwN30.v-zypq4wN5EW0z8dxbUHWeNzDhuTylyL4chpBfTISxE';

function getSupabaseConfig(){
  try{
    // Helper: try to find a numeric count in different response shapes
    function extractCount(rec, raw){
      // If the RPC returned a plain number
      if(typeof raw === 'number') return raw;
      if(typeof raw === 'string' && !isNaN(Number(raw))) return Number(raw);
      // If record is an object with hit_count
      if(rec && typeof rec === 'object'){
        if(rec.hit_count != null && !isNaN(Number(rec.hit_count))) return Number(rec.hit_count);
        // try common variants
        if(rec.count != null && !isNaN(Number(rec.count))) return Number(rec.count);
        if(rec.hits != null && !isNaN(Number(rec.hits))) return Number(rec.hits);
        // fall back to first numeric property
        for(const k of Object.keys(rec)){
          const v = rec[k];
          if(typeof v === 'number') return v;
          if(typeof v === 'string' && !isNaN(Number(v))) return Number(v);
        }
      }
      return null;
    }
    const metaUrl = document.querySelector('meta[name="supabase-url"]');
    const metaKey = document.querySelector('meta[name="supabase-anon-key"]');
    const apiUrl = metaUrl && metaUrl.content.trim() ? metaUrl.content.trim() : FALLBACK_API_URL;
    const anonKey = metaKey && metaKey.content.trim() ? metaKey.content.trim() : FALLBACK_ANON_KEY;
    return { apiUrl, anonKey };
  }catch(e){ return { apiUrl: FALLBACK_API_URL, anonKey: FALLBACK_ANON_KEY }; }
}

async function recordHitRpc(pagePath, countElId = 'hit-count', fallbackId = 5){
  const { apiUrl, anonKey } = getSupabaseConfig();
  const headers = { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' };
  const hitCountEl = document.getElementById(countElId);

  async function postRpc(name, bodyObj){
    try{
      const resp = await fetch(`${apiUrl}/rest/v1/rpc/${name}`, { method:'POST', headers, body: JSON.stringify(bodyObj) });
      if(!resp.ok) return { ok:false, status: resp.status };
      const data = await resp.json();
      return { ok:true, data };
    }catch(err){ return { ok:false, error: err }; }
  }

    try{
    // Try page_path based RPC first
    const pageResp = await postRpc('increment_page_hit', { page_path: pagePath, last_ip_hash: 'browser-' + Math.random().toString(36).substring(7) });
    if(pageResp.ok){
      const rec = Array.isArray(pageResp.data) ? pageResp.data[0] : pageResp.data;
      const count = extractCount(rec, pageResp.data);
      console.debug('hitcounter: pageResp raw data=', pageResp.data, 'extracted count=', count);
      if(hitCountEl) hitCountEl.textContent = (count != null) ? Number(count).toLocaleString() : '---';
      return;
    }

    // Fallback to id-based RPC (existing logic uses id = 5)
    const idResp = await postRpc('increment_page_hit_by_id', { p_id: fallbackId });
    if(idResp.ok){
      const rec = Array.isArray(idResp.data) ? idResp.data[0] : idResp.data;
      const count = extractCount(rec, idResp.data);
      console.debug('hitcounter: idResp raw data=', idResp.data, 'extracted count=', count);
      if(hitCountEl) hitCountEl.textContent = (count != null) ? Number(count).toLocaleString() : '---';
      return;
    }

    if(hitCountEl) hitCountEl.textContent = '---';
  }catch(err){
    console.warn('Hit counter error', err);
    if(hitCountEl) hitCountEl.textContent = '---';
  }
}

// Expose globally for non-module pages
try{ window.recordHitRpc = recordHitRpc; }catch(e){}

// Auto-run for VibeCode2 page (keeps previous behavior)
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ()=> recordHitRpc('VibeCode2', 'hit-count'));
} else {
  recordHitRpc('VibeCode2', 'hit-count');
}
