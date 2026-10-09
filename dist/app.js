(() => {
  const data = window.PORTFOLIO;
  const ui = window.PORTFOLIO_UI;
  const cache = window.PORTFOLIO_ZH || {};
  let language = 'en';
  try { language = localStorage.getItem('portfolio-language') === 'zh' ? 'zh' : 'en'; if(localStorage.getItem('portfolio-theme') === 'dark') document.body.classList.add('dark'); } catch {}
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const translate = value => language === 'zh' ? cache[value] || value : value;
  const text = (value, tag='span', attrs='') => `<${tag} data-source="${escape(value)}" ${attrs}>${escape(translate(value))}</${tag}>`;
  const authors = value => `<p class="authors">${value.split(',').map(name => {
    const author = name.trim();
    return author === data.profile.name ? `<strong>${escape(author)}</strong>` : escape(author);
  }).join(', ')}</p>`;
  const nav = ['education','publications','projects','experiences','skills','hobbies'];
  const link = (url,label) => { try { const parsed=new URL(url); return ['http:','https:'].includes(parsed.protocol) ? `<a class="resource-link" href="${escape(parsed.href)}" target="_blank" rel="noopener noreferrer">${text(label)}</a>`:''; } catch{return '';} };
  const heading = (number, key) => `<div class="section-heading"><div><span class="eyebrow">${number} / ${text(ui[key])}</span>${text(ui[key],'h2')}</div></div>`;
  const tags = items => items.map(t=>text(t,'span','class="tag"')).join('');
  document.querySelector('header').innerHTML = `<a class="brand" href="#home"><span class="monogram">MY</span><span>It's MYAO</span></a><nav aria-label="Main navigation">${nav.map(k=>`<a href="#${k}">${text(ui[k])}</a>`).join('')}</nav><div class="controls"><button id="language" type="button">中文</button><button id="theme" type="button">☾</button></div>`;
  document.querySelector('main').innerHTML = `
  <section class="hero" id="home"><div>${text(data.profile.eyebrow,'div','class="eyebrow"')}${text(data.profile.name,'h1')}${text(data.profile.headline,'p','class="intro"')}${text(data.profile.bio,'p','class="bio"')}<div class="affiliation"><div class="university-line">${text(data.profile.university,'strong')}<span aria-hidden="true"> · </span>${text(data.profile.location)}</div>${text(data.profile.department)}<span class="advisors">${text(ui.advisors)} ${link('https://people.cs.gmu.edu/~sqchen/','Prof. Songqing Chen')} ${text(ui.and)} ${link('https://people.cs.gmu.edu/~bohan/index.html','Prof. Bo Han')}.</span></div><a class="primary" href="https://www.linkedin.com/in/tingting-yao-3b7a92303" target="_blank" rel="noopener noreferrer">LinkedIn</a><a class="secondary" href="https://scholar.google.com/citations?user=zCy-QkkAAAAJ&amp;hl=en" target="_blank" rel="noopener noreferrer">Google Scholar</a></div><aside class="profile"><img class="portrait" src="Profile.JPG" alt="${escape(data.profile.name)}" width="310" height="310"></aside></section>
  <section id="education">${heading('01','education')}<div class="grid two">${data.education.map(e=>`<article class="card">${text(e.period,'span','class="meta"')}${text(e.degree,'h3')}${text(e.institution,'strong')}${text(e.description,'p')}</article>`).join('')}</div></section>
  <section id="publications">${heading('02','publications')}${data.publications.map(p=>`<article class="publication"><span class="meta">${escape(p.year)}</span><div>${text(p.title,'h3')}${authors(p.authors)}${text(p.venue,'p')}${link(p.url,ui.paper)}${p.abstract ? `<details>${text(ui.abstract,'summary')}${text(p.abstract,'p')}</details>` : ''}</div></article>`).join('')}</section>
  <section id="projects">${heading('03','projects')}<div class="tabs" role="group" aria-label="Project filters">${['all',...new Set(data.projects.map(p=>p.type))].map(k=>`<button data-filter="${k}" aria-pressed="${k==='all'}">${text(ui[k])}</button>`).join('')}</div><div class="grid two">${data.projects.map(p=>`<article class="card project" data-type="${escape(p.type)}">${text(ui[p.type==='research'?'researchType':'softwareType'],'span','class="meta"')}${text(p.name,'h3')}${p.organization ? text(p.organization,'p') : ''}${p.period ? text(p.period,'p') : ''}${p.description ? text(p.description,'p') : ''}<div>${tags(p.tags)}</div>${p.bullets?.length ? `<details class="project-details">${text(ui.notes,'summary')}<ul class="project-bullets">${p.bullets.map(bullet=>text(bullet,'li')).join('')}</ul>${link(p.url,ui.project)}</details>` : link(p.url,ui.project)}</article>`).join('')}</div></section>
  <section id="experiences">${heading('04','experiences')}<div class="timeline">${data.experiences.map(e=>`<article>${text(e.period,'span','class="meta"')}${text(e.role,'h3')}${text(e.organization,'p')}${text(e.description,'p')}</article>`).join('')}</div></section>
  <section id="skills">${heading('05','skills')}<div class="grid skills-grid">${data.skills.map(s=>`<article class="card">${text(s.category,'h3')}<div>${tags(s.items)}</div></article>`).join('')}</div></section>
  <section id="hobbies">${heading('06','hobbies')}<div class="grid research-grid">${data.hobbies.map(h=>`<article class="card">${text(h.category,'h3')}<ul class="hobby-list">${h.items.map(item=>text(item,'li')).join('')}</ul></article>`).join('')}</div></section>
  `;
  document.querySelector('footer').innerHTML=`<span>© ${new Date().getFullYear()} ${text(data.profile.name)}</span>${text(ui.footer)}<a href="#home">${text(ui.top)}</a>`;
  const languageButton=document.getElementById('language');
  const themeButton=document.getElementById('theme');
  function themeLabel(){const dark=document.body.classList.contains('dark');themeButton.textContent=dark?'☀':'☾';themeButton.setAttribute('aria-label',translate(dark?ui.light:ui.dark));}
  function applyLanguage(){
    document.documentElement.lang=language==='zh'?'zh-CN':'en';
    const missing=new Set();
    document.querySelectorAll('[data-source]').forEach(el=>{const source=el.dataset.source;el.textContent=translate(source);if(language==='zh'&&!Object.hasOwn(cache,source))missing.add(source);});
    document.title="It's MYAO";
    document.querySelector('meta[name="description"]').content=translate(data.profile.bio);
    document.querySelector('.skip').textContent=translate(ui.skip);
    document.querySelector('nav').setAttribute('aria-label',translate(ui.navigation));
    document.querySelector('.tabs').setAttribute('aria-label',translate(ui.filters));
    languageButton.textContent=language==='en'?'中文':'EN';languageButton.setAttribute('aria-label',language==='en'?'Switch to Chinese':'Switch to English');
    themeLabel();
  }
  languageButton.addEventListener('click',()=>{language=language==='en'?'zh':'en';applyLanguage();try{localStorage.setItem('portfolio-language',language)}catch{}});
  themeButton.addEventListener('click',()=>{document.body.classList.toggle('dark');themeLabel();try{localStorage.setItem('portfolio-theme',document.body.classList.contains('dark')?'dark':'light')}catch{}});
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('.project').forEach(p=>p.hidden=button.dataset.filter!=='all'&&p.dataset.type!==button.dataset.filter);}));
  applyLanguage();
})();
