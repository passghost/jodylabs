#!/usr/bin/env node
// Scrape a public Google Drive folder page and generate Adimages/drive_manifest.json
// Usage: node tools/gdrive_folder_to_manifest.mjs "https://drive.google.com/drive/folders/<FOLDER_ID>?usp=sharing" [max=100]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

function normalizeDriveUrl(u){
  try{
    const url = new URL(u);
    if (url.hostname.includes('drive.google.com')){
      const m = url.pathname.match(/\/file\/d\/([^/]+)/);
      if (m && m[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
      const id = url.searchParams.get('id');
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    }
  }catch(_){}
  return u;
}

async function main(){
  const folderUrl = process.argv[2];
  const max = parseInt(process.argv[3] || '120', 10);
  if (!folderUrl){
    console.error('Missing folder URL.');
    console.error('Usage: node tools/gdrive_folder_to_manifest.mjs "https://drive.google.com/drive/folders/<FOLDER_ID>?usp=sharing" [max=120]');
    process.exit(2);
  }
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);
  try{
    await page.goto(folderUrl, { waitUntil: 'networkidle2' });
    // Attempt to dismiss consent dialogs if present
    try{
      const buttons = await page.$$('form[action*="consent"] button, button[aria-label*="Accept" i], button');
      for (const b of buttons){
        const txt = (await page.evaluate(el => el.textContent || '', b)).trim().toLowerCase();
        if (txt.includes('accept') || txt.includes('agree') || txt.includes('i agree') || txt.includes('accept all')){ await b.click().catch(()=>{}); break; }
      }
      await sleep(1500);
    }catch(_){ /* no consent dialog */ }

    // Ensure grid/list is rendered
    await sleep(3000);

    // Try to scroll to load more items
    try{
      await page.evaluate(async()=>{
        const scroller = document.scrollingElement || document.documentElement;
        for (let i=0;i<10;i++){
          scroller.scrollTop = scroller.scrollHeight;
          await new Promise(r=>setTimeout(r, 400));
        }
      });
    }catch(_){ }

    // Collect file ids
    const ids = await page.evaluate(()=>{
      const hrefs = Array.from(document.querySelectorAll('a'))
        .map(a=>a.href)
        .filter(h=> h && h.includes('/file/d/'));
      const idSet = new Set(hrefs.map(h=>{
        const m = h.match(/\/file\/d\/([^/]+)/);
        return m && m[1] ? m[1] : null;
      }).filter(Boolean));
      document.querySelectorAll('[data-id]').forEach(el=>{ const id = el.getAttribute('data-id'); if (id && id.length > 10) idSet.add(id); });
      return Array.from(idSet);
    });

    if (!ids.length){
      console.error('No file IDs found on the folder page. Is the folder public?');
      process.exit(1);
    }

  // Prefer thumbnail endpoint to reduce ORB blocks
  const directUrls = ids.slice(0, max).map(id => `https://drive.google.com/thumbnail?id=${id}&sz=w1000`);
    const outDir = path.join(__dirname, '..', 'Adimages');
    const outFile = path.join(outDir, 'drive_manifest.json');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(directUrls, null, 2));
    console.log(`Wrote ${directUrls.length} entries to ${path.relative(process.cwd(), outFile)}`);
  }finally{
    await browser.close();
  }
}

main().catch(err=>{ console.error(err?.message || err); process.exit(1); });
