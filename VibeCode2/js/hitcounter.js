// Shared hit counter utility used by Vibe pages
// Exposes `window.recordHitRpc(pagePath, countElId, fallbackId)`
(function(){
  'use strict';

  function readMeta(name){
    const m = document.querySelector('meta[name="' + name + '"]');
    return m ? (m.content || '').trim() : '';
  }

  function toNum(v){
    if(v == null) return null;
    if(typeof v === 'number') return v;
    if(typeof v === 'string'){
      const n = Number(v.replace(/[,\s]/g,''));
      return Number.isNaN(n) ? null : n;
    }
    return null;
  }

  function extractCount(rec, raw){
    // Handle common shapes: { hit_count }, { count }, { hits }, numeric literal, array wrapper
    if(rec == null){
      if(typeof raw === 'number') return raw;
      if(Array.isArray(raw) && raw.length){
        return extractCount(raw[0], raw[0]);
      }
      return null;
    }
    if(typeof rec === 'number') return rec;
    if(typeof rec === 'string'){
      const n = toNum(rec);
      if(n != null) return n;
    }
    if(typeof rec === 'object'){
      const keys = ['hit_count','hitcount','count','hits','total','value'];
      for(const k of keys){
        if(k in rec){
          const n = toNum(rec[k]);
          if(n != null) return n;
        }
      }
      // fallback: first numeric property
      for(const k of Object.keys(rec)){
        const n = toNum(rec[k]);
        if(n != null) return n;
      }
    }
    return null;
  }

  async function postRpc(apiUrl, anonKey, fnName, bodyObj){
    const headers = {
      'apikey': anonKey,
      'Authorization': 'Bearer ' + anonKey,
      'Content-Type': 'application/json'
    };
    try{
      const resp = await fetch(apiUrl.replace(/\/$/, '') + '/rest/v1/rpc/' + fnName, {
        method: 'POST', headers, body: JSON.stringify(bodyObj)
      });
      const text = await resp.text();
      let data;
      try{ data = text ? JSON.parse(text) : null; }catch(e){ data = text; }
      return { ok: resp.ok, status: resp.status, data, rawText: text };
    }catch(err){
      return { ok: false, error: err };
    }
  }

  async function recordHitRpc(pagePath, countElId, fallbackId=5){
    const apiUrl = readMeta('supabase-url');
    const anonKey = readMeta('supabase-anon-key');
    const el = document.getElementById(countElId);
    if(!el){ console.warn('hitcounter: target element not found', countElId); return; }
    if(!apiUrl || !anonKey){ el.textContent = '---'; console.error('hitcounter: supabase-url or anon key missing'); return; }

    const candidates = ['increment_page_hit','increment_page_hit_id' + fallbackId, 'id' + fallbackId];

    for(const name of candidates){
      const body = { page_path: pagePath, last_ip_hash: 'browser-' + Math.random().toString(36).slice(2,10) };
      const res = await postRpc(apiUrl, anonKey, name, body);
      console.debug('hitcounter: pageResp', name, res);
      if(res.ok && res.data != null){
        const rec = Array.isArray(res.data) ? res.data[0] : res.data;
        const n = extractCount(rec, res.data);
        if(n != null){ el.textContent = n.toLocaleString(); return; }
      }
    }

    // fallback to id-based RPC signature using p_id
    const idRes = await postRpc(apiUrl, anonKey, 'increment_page_hit_by_id', { p_id: fallbackId });
    console.debug('hitcounter: idResp', idRes);
    if(idRes.ok && idRes.data != null){
      const rec = Array.isArray(idRes.data) ? idRes.data[0] : idRes.data;
      const n = extractCount(rec, idRes.data);
      if(n != null){ el.textContent = n.toLocaleString(); return; }
    }

    el.textContent = '---';
    console.error('hitcounter: all RPC attempts failed or returned unexpected shape');
  }

  // Export
  window.recordHitRpc = recordHitRpc;

  // Auto-run for legacy pages that rely on a fixed id and specific element ids
  document.addEventListener('DOMContentLoaded', ()=>{
    // If page includes expected elements, auto-invoke
    if(document.getElementById('hit-count')){
      recordHitRpc('Vibe1','hit-count',5).catch(()=>{});
    }
    if(document.getElementById('hit-count-pill')){
      recordHitRpc('Vibe4','hit-count-pill',5).catch(()=>{});
    }
    if(document.getElementById('hit-counter')){
      recordHitRpc('Index','hit-counter',5).catch(()=>{});
    }
  });

})();
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
