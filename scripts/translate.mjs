import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function collectStrings(value, output = new Set(), key = '') {
  if (['initials', 'email', 'url', 'type', 'year'].includes(key)) return output;
  if (typeof value === 'string' && value.trim()) output.add(value);
  else if (Array.isArray(value)) value.forEach(item => collectStrings(item, output));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => collectStrings(v, output, k));
  return output;
}
export function batches(strings) {
  const result = []; let batch = [], size = 0;
  for (const text of strings) {
    const bytes = Buffer.byteLength(JSON.stringify(text));
    if (bytes > 90000) throw new Error('One text exceeds the translation request limit. Split the paragraph.');
    if (batch.length >= 40 || size + bytes > 90000) { result.push(batch); batch = []; size = 0; }
    batch.push(text); size += bytes;
  }
  if (batch.length) result.push(batch);
  return result;
}
export async function requestTranslation(text, key, fetcher = fetch) {
  const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetcher(`${host}/v2/translate`, {
      method: 'POST', headers: {'Authorization': `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({text, source_lang: 'EN', target_lang: 'ZH-HANS', preserve_formatting: true}),
      signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1500 * 2 ** attempt)); continue;
      }
      throw new Error(`DeepL returned HTTP ${response.status}. Check DEEPL_API_KEY, API quota and account access. No deployment was published.`);
    }
    const payload = await response.json();
    if (!Array.isArray(payload.translations) || payload.translations.length !== text.length || payload.translations.some(t => typeof t.text !== 'string' || !t.text.trim())) {
      throw new Error('Translation response is incomplete. Existing translations have not been changed.');
    }
    return payload.translations.map(t => t.text);
  }
}
export async function build({root, check = false, key = process.env.DEEPL_API_KEY, fetcher = fetch} = {}) {
  root ||= path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dist = path.join(root, 'dist');
  const context = {window: {}};
  for (const name of ['content.js', 'ui.js', 'translations.js']) {
    let script;
    try { script = await fs.readFile(path.join(dist, name), 'utf8'); } catch (e) { if(name === 'translations.js' && e.code === 'ENOENT') continue; throw e; }
    vm.runInNewContext(script, context, {timeout:1000, filename:name});
  }
  const strings = collectStrings(context.window.PORTFOLIO);
  collectStrings(context.window.PORTFOLIO_UI, strings);
  let restored = {};
  const cacheFile = path.join(root, '.translation-cache', 'zh.json');
  try { restored = JSON.parse(await fs.readFile(cacheFile, 'utf8')); } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Ignoring unreadable optional translation cache.');
  }
  // Committed translations take precedence over older Actions cache entries.
  const cache = {...restored, ...(context.window.PORTFOLIO_ZH || {})};
  const missing = [...strings].filter(s => !Object.hasOwn(cache,s) || typeof cache[s] !== 'string' || !cache[s].trim());
  if (check) {
    if (missing.length) throw new Error(`${missing.length} texts need translation. Run the publishing workflow with DEEPL_API_KEY configured.`);
    console.log(`Translation coverage: ${strings.size}/${strings.size}.`); return;
  }
  if (missing.length && !key) throw new Error('New English text needs translation. Add DEEPL_API_KEY in GitHub Settings > Secrets and variables > Actions, then rerun. No deployment was published.');
  for (const batch of batches(missing)) {
    const translated = await requestTranslation(batch, key, fetcher);
    batch.forEach((source,i) => {cache[source] = translated[i];});
  }
  const current = Object.fromEntries([...strings].map(s=>[s,cache[s]]));
  const target = path.join(dist,'translations.js');
  const output = '// Generated translation cache. Edit English in content.js; do not maintain this by hand.\nwindow.PORTFOLIO_ZH = '+JSON.stringify(current,null,2)+';\n';
  await fs.writeFile(target+'.tmp',output); await fs.rename(target+'.tmp',target);
  await fs.mkdir(path.dirname(cacheFile), {recursive:true});
  await fs.writeFile(cacheFile, JSON.stringify(current));
  console.log(`Translated ${missing.length} changed texts; ${strings.size-missing.length} cached texts reused.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build({check:process.argv.includes('--check')}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
