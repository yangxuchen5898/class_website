// 前端单页应用 - 使用 localStorage 保存文档，sessionStorage 存储当前用户信息
// 用户表（将由 passwords.csv 覆盖）
const USERS = {};
let usersLoaded = false;

// 从 passwords.csv 加载用户（支持多种编码，优先尝试 utf-8，然后 gb18030/gbk）
async function loadUsersFromCsv(){
  try {
    const res = await fetch('passwords.csv');
    if(!res.ok) return false;
    const buffer = await res.arrayBuffer();
    const tryEncodings = ['utf-8','utf8','gb18030','gbk','windows-1252'];
    let text = null;
    for(const enc of tryEncodings){
      try{
        const dec = new TextDecoder(enc);
        text = dec.decode(buffer);
        // quick heuristic: if the text contains the Chinese word for "姓名" or lots of non-ASCII, accept
        if(/姓名|账号|学号|密码/.test(text) || /[\u4e00-\u9fa5]/.test(text)) break;
      }catch(e){
        text = null;
      }
    }
    if(!text) return false;

    // split into lines and parse (支持 tab 或 comma 分隔)
    const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').map(l=>l.trim()).filter(Boolean);
    // detect header - first line may be header (中文)，如果第一行包含非数字则跳过
    let start = 0;
    if(lines.length>0 && /[\u4e00-\u9fa5]/.test(lines[0])) start = 1;
    for(let i = start; i < lines.length; i++){
      const line = lines[i];
      const cols = line.split(/\t|,/).map(c=>c.trim());
      if(cols.length < 2) continue;
      const account = cols[0];
      const name = cols[1] || '';
      const pwd = cols[2] || '111111';
      if(account) USERS[account] = { name, password: pwd };
    }
    usersLoaded = true;
    return true;
  } catch(err){
    console.warn('Failed to load passwords.csv', err);
    return false;
  }
}

// 启动时异步加载 CSV（不会阻塞页面）
loadUsersFromCsv().then(ok=>{
  if(!ok){
    // fallback: 如果加载失败，保留空 USERS，登录将提示账号无效
    console.info('users not loaded from CSV, using fallback (no users)');
  }
  // mark as finished attempting to load so login won't block forever
  usersLoaded = true;
  console.info(`USERS loaded: ${Object.keys(USERS).length}`);
});

// ...existing code...
const btnLogout = document.getElementById('btn-logout');
const btnLogin = document.getElementById('btn-login');
const welcome = document.getElementById('welcome');
const loginModal = document.getElementById('login-modal');
const loginSubmit = document.getElementById('login-submit');
const loginCancel = document.getElementById('login-cancel');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const changePasswordModal = document.getElementById('change-password-modal');
const changePasswordSubmit = document.getElementById('change-password-submit');
const changePasswordCancel = document.getElementById('change-password-cancel');
const oldPassword = document.getElementById('old-password');
const newPassword = document.getElementById('new-password');
const authPanel = document.getElementById('auth-panel');
const pleaseLogin = document.getElementById('please-login');
const docListEl = document.getElementById('docs');
const docTitle = document.getElementById('doc-title');
// editor host (CodeMirror) 挂载点
const editorHost = document.getElementById('editor');

// 编辑器实例（CodeMirror 或 fallback textarea）
let editor = null;
function initEditor(){
  if(window.CodeMirror && editorHost){
    editor = CodeMirror(editorHost, {
      mode: 'markdown',
      lineNumbers: true,
      lineWrapping: true,
      value: ''
    });
  // 在 change 时同时调度 in-place 渲染并更新右侧预览
  editor.on('change', ()=>{ onEditorChangeForInPlace(); });
  } else if(editorHost){
    // fallback textarea
    const ta = document.createElement('textarea');
    ta.style.width = '100%'; ta.style.height = '100%';
    editorHost.appendChild(ta);
    ta.addEventListener('input', ()=>{ renderLivePreview(); });
    editor = {
      getValue: ()=> ta.value,
      setValue: (v)=> { ta.value = v; }
    };
  }
}

function editorGetValue(){ return editor && typeof editor.getValue === 'function' ? editor.getValue() : ''; }
function editorSetValue(v){ if(editor && typeof editor.setValue === 'function') editor.setValue(v||''); }
const saveDocBtn = document.getElementById('save-doc');
const newDocBtn = document.getElementById('new-doc');
const searchInput = document.getElementById('search');

function getPreviewEl(){ return document.getElementById('preview') || document.getElementById('render-overlay') || null; }

// marked 配置：代码块保持 class="language-..." 以便 highlight.js 识别
marked.setOptions({
  gfm: true,
  breaks: true,
  highlight: function(code, lang){
    // 返回未高亮的代码片段，实际高亮由 highlight.js 在渲染后处理
    if(lang){ return code; }
    return code;
  }
});

let currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
let editingId = null;
let docs = JSON.parse(localStorage.getItem('docs')||'[]');

function showLoginModal(){ loginModal.style.display='flex'; }
function hideLoginModal(){ loginModal.style.display='none'; loginUsername.value=''; loginPassword.value=''; }
function showChangePasswordModal(){ changePasswordModal.style.display='flex'; }
function hideChangePasswordModal(){ changePasswordModal.style.display='none'; oldPassword.value=''; newPassword.value=''; }

btnLogin.addEventListener('click', showLoginModal);
loginCancel.addEventListener('click', hideLoginModal);
loginSubmit.addEventListener('click', async ()=>{
  // 等待 USERS 加载（最多等待 1 秒）
  const start = Date.now();
  while(!usersLoaded && Date.now() - start < 1000){
    await new Promise(r=>setTimeout(r, 50));
  }
  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();
  const user = USERS[username];
  if (!user) {
    alert('账号无效，请确认学号');
    return;
  }
  if (password !== user.password) {
    alert('密码错误');
    return;
  }
  currentUser = { id: username, name: user.name };
  sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
  hideLoginModal();
  renderAuth();
  renderList();
});

btnLogout.addEventListener('click', ()=>{
  sessionStorage.removeItem('currentUser');
  currentUser = null;
  renderAuth();
  renderList();
});

changePasswordSubmit.addEventListener('click', ()=>{
  const oldPwd = oldPassword.value.trim();
  const newPwd = newPassword.value.trim();
  if(!newPwd) {
    alert('请输入新密码');
    return;
  }
  const user = USERS[currentUser.id];
  if (user.password !== oldPwd) {
    alert('原密码错误');
    return;
  }
  user.password = newPwd;
  alert('密码修改成功');
  hideChangePasswordModal();
});

changePasswordCancel.addEventListener('click', hideChangePasswordModal);

function renderAuth(){ if(currentUser){ welcome.innerHTML = `你好，${currentUser.name} <button onclick="showChangePasswordModal()">修改密码</button>`; btnLogin.style.display='none'; btnLogout.style.display='inline-block'; authPanel.style.display='block'; pleaseLogin.style.display='none'; } else { welcome.textContent=''; btnLogin.style.display='inline-block'; btnLogout.style.display='none'; authPanel.style.display='none'; pleaseLogin.style.display='block'; }}
// 当显示编辑面板时，确保 CodeMirror 正确计算并获得焦点
const _origRenderAuth = renderAuth;
function renderAuthWrapper(){ _origRenderAuth();
  if(currentUser && editor && typeof editor.refresh === 'function'){
    try{ editor.refresh(); }catch(e){}
  }
}
// 替换为 wrapper
renderAuth = renderAuthWrapper;

function saveDocsToStorage(){ localStorage.setItem('docs', JSON.stringify(docs)); }

function generateId(){ return 'doc_' + Date.now() + '_' + Math.floor(Math.random()*1000); }

function renderList(){ const q = searchInput.value.trim().toLowerCase();
  docListEl.innerHTML='';
  const sorted = docs.slice().sort((a,b)=>b.updatedAt - a.updatedAt);
  sorted.filter(d=>{
    if(!q) return true;
    return (d.title && d.title.toLowerCase().includes(q)) || (d.owner && d.owner.includes(q));
  }).forEach(d=>{
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<div><strong>${escapeHtml(d.title||'(无标题)')}</strong></div><div class='meta'>作者: ${d.owner} · ${new Date(d.updatedAt).toLocaleString()}</div>`;
    const actions = document.createElement('div');
    actions.style.display='flex'; actions.style.gap='6px';

    const viewBtn = document.createElement('button'); viewBtn.textContent='查看'; viewBtn.onclick=()=>{ openDoc(d.id, false); };
    const editBtn = document.createElement('button'); editBtn.textContent='编辑'; editBtn.onclick=()=>{ if(!currentUser){ alert('请先登录'); return; } openDoc(d.id, true); };
    const delBtn = document.createElement('button'); delBtn.textContent='删除'; delBtn.onclick=()=>{ if(!currentUser || currentUser.id !== d.owner){ alert('只有作者可删除'); return;} if(confirm('确认删除？')){ docs = docs.filter(x=>x.id!==d.id); saveDocsToStorage(); renderList(); }};
    const likeBtn = document.createElement('button'); likeBtn.textContent=`❤ ${d.likes||0}`; likeBtn.onclick=()=>{ d.likes = (d.likes||0)+1; d.updatedAt = Date.now(); saveDocsToStorage(); renderList(); };

    [viewBtn, editBtn, delBtn, likeBtn].forEach(b=>{ b.style.padding='4px 8px'; b.style.border='1px solid #ccc'; b.style.background='#fff'; b.style.cursor='pointer'; });

    actions.appendChild(viewBtn); actions.appendChild(editBtn); actions.appendChild(delBtn); actions.appendChild(likeBtn);
    li.appendChild(left); li.appendChild(actions);
    docListEl.appendChild(li);
  });
}

function openDoc(id, forEdit){ const d = docs.find(x=>x.id===id); if(!d) return; editingId = forEdit? d.id : null; docTitle.value = d.title || ''; editorSetValue(d.content || '');
  if(forEdit){ if(!currentUser){ alert('请先登录'); return; } if(currentUser !== d.owner && !confirm('你不是作者，确定以编辑者身份覆盖？')){ return; } }
  // always render preview for live editing
  renderLivePreview();
  // refresh and focus editor so CodeMirror can accept input
  if(editor && typeof editor.refresh === 'function'){ try{ editor.refresh(); if(typeof editor.focus === 'function') editor.focus(); }catch(e){} }
}

function renderLivePreview(){ try{
  const md = editorGetValue() || '';
    // use marked to convert markdown to HTML
    let html = marked.parse(md, {
      breaks: true,
      gfm: true
    });
    // insert html into the preview target (preview pane or overlay fallback)
  const previewElLocal = getPreviewEl();
  if(!previewElLocal) return; // no preview target available
  previewElLocal.innerHTML = (window.DOMPurify && typeof DOMPurify.sanitize === 'function') ? DOMPurify.sanitize(html) : html;
    // render KaTeX for inline and block formulas
    if(window.renderMathInElement) {
      try{ renderMathInElement(previewElLocal, {delimiters: [{left: '$$', right:'$$', display:true},{left:'\\[', right:'\\]', display:true},{left:'$', right:'$', display:false},{left:'\\(', right:'\\)', display:false}]}); }catch(e){console.warn('katex render failed', e);}    
    }
    // highlight code blocks
    if(window.hljs){ previewElLocal.querySelectorAll('pre code').forEach((block)=>{ try{ hljs.highlightElement(block); }catch(e){} }); }
  }catch(e){ console.warn('Preview render error', e); }
}

// Typora-like in-place rendering overlay (bound after DOM ready)
let overlay = null;
let renderTimer = null;
function scheduleInPlaceRender(){
  if(renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(()=>{ doInPlaceRender(); }, 700);
}

function doInPlaceRender(){
  try{
    const md = editorGetValue() || '';
    const html = marked.parse(md, { breaks:true, gfm:true });
  // sanitize before inserting into overlay
  overlay.innerHTML = (window.DOMPurify && typeof DOMPurify.sanitize === 'function') ? DOMPurify.sanitize(html) : html;
    overlay.style.display = 'block';
    // KaTeX
    if(window.renderMathInElement){ try{ renderMathInElement(overlay, {delimiters: [{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]}); }catch(e){console.warn(e);} }
    // highlight
    if(window.hljs){ overlay.querySelectorAll('pre code').forEach(b=>{ try{ hljs.highlightElement(b); }catch(e){} }); }
  }catch(e){ console.warn('in-place render failed', e); }
}

// wire editor change to schedule in-place render
function onEditorChangeForInPlace(){ scheduleInPlaceRender(); renderLivePreview(); }

// sync scrolling between editor and overlay/preview (best-effort)
function syncScroll(){
  try{
    if(!editor) return;
    let ratio = 0;
    if(typeof editor.getScrollInfo === 'function'){
      const info = editor.getScrollInfo();
      ratio = info.top / Math.max(1, info.height - info.clientHeight);
    } else if(editor.getValue){
      // fallback: no precise scroll info
      ratio = 0;
    }
  if(overlay){ overlay.scrollTop = ratio * Math.max(0, overlay.scrollHeight - overlay.clientHeight); }
  const previewElLocal = getPreviewEl();
  if(previewElLocal){ previewElLocal.scrollTop = ratio * Math.max(0, previewElLocal.scrollHeight - previewElLocal.clientHeight); }
  }catch(e){}
}

// bind editor scroll if CodeMirror
function bindEditorScroll(){ if(editor && typeof editor.on === 'function' && typeof editor.getScrollInfo === 'function'){ editor.on('scroll', syncScroll); } }

saveDocBtn.addEventListener('click', ()=>{
  if(!currentUser){ alert('请先登录'); return; }
  const title = docTitle.value.trim();
  if(!title){ alert('请填写标题'); return; }
  const content = editorGetValue();
  if(editingId){ const d = docs.find(x=>x.id===editingId); if(!d) return; d.title = title; d.content = content; d.updatedAt = Date.now(); d.owner = d.owner || currentUser.id; d.ownerName = d.ownerName || currentUser.name; } else { const doc = { id: generateId(), title, content, owner: currentUser.id, ownerName: currentUser.name, createdAt: Date.now(), updatedAt: Date.now(), likes:0 }; docs.push(doc); editingId = doc.id; }
  saveDocsToStorage(); renderList(); alert('保存成功');
  // 更新预览
  renderLivePreview();
});

newDocBtn.addEventListener('click', ()=>{ if(!currentUser){ alert('请先登录'); return; } editingId = null; docTitle.value=''; editorSetValue(''); renderLivePreview(); if(editor && typeof editor.refresh==='function'){ try{ editor.refresh(); if(typeof editor.focus==='function') editor.focus(); }catch(e){} } });
searchInput.addEventListener('input', renderList);

// small utility
function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// carousel simple
// 轮播图初始化（纯前端）
function initCarousel(){
  const slides = document.querySelector('.carousel .slides');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  let idx = 0;
  const list = Array.isArray(window.CAROUSEL_PHOTOS) ? window.CAROUSEL_PHOTOS : [];
  const total = list.length;
  slides.innerHTML = '';
  for(let i = 0; i < total; i++){
    const slide = document.createElement('div');
    slide.className = 'slide';
    const img = document.createElement('img');
    img.src = `class_photos/${list[i]}`;
    img.alt = `photo${i+1}`;
    img.onload = ()=>{ /* no-op */ };
    img.onerror = () => {
      img.style.opacity = '0.4';
      img.style.background = '#eee';
    };
    slide.appendChild(img);
    slides.appendChild(slide);
  }
  // ensure slides container displays as flex
  try{ slides.style.display = 'flex'; }catch(e){}
  const carouselEl = document.querySelector('.carousel');
  function show(i){
    try{
      const cw = carouselEl ? carouselEl.clientWidth : (slides.clientWidth / Math.max(1, total));
      const shift = -i * cw;
      slides.style.transform = `translateX(${shift}px)`;
    }catch(e){ slides.style.transform = `translateX(${-i*100}%)`; }
  }
  // reposition on resize to keep current slide aligned
  window.addEventListener('resize', ()=>{ show(idx); });
  prevBtn.addEventListener('click', () => {
    idx = (idx-1+total)%total;
    show(idx);
  });
  nextBtn.addEventListener('click', () => {
    idx = (idx+1)%total;
    show(idx);
  });
  if(total > 0){
    show(0);
    setInterval(() => {
      idx = (idx+1)%total;
      show(idx);
    }, 5000);
  }
}

// 页面加载后初始化轮播图
window.addEventListener('DOMContentLoaded', () => {
  // 初始化编辑器（CodeMirror 或 fallback）
  try{ initEditor(); }catch(e){ console.warn('initEditor failed', e); }
  // bind scroll sync and initial render schedule
  try{ bindEditorScroll(); scheduleInPlaceRender(); }catch(e){}
  // 初始化轮播
  initCarousel();
  // bind overlay after DOM ready
  overlay = document.getElementById('render-overlay');
  if(overlay){ overlay.addEventListener('click', (ev)=>{ overlay.style.display='none'; try{ if(editor && typeof editor.focus==='function') editor.focus(); }catch(e){} }); }
  // ensure auth rendering is refreshed now editor exists
  try{ renderAuth(); }catch(e){}

  // observe authPanel visibility changes and refresh editor when it becomes visible
  try{
    const mo = new MutationObserver(()=>{
      try{
        if(getComputedStyle(authPanel).display !== 'none'){
          setTimeout(()=>{ if(editor && typeof editor.refresh === 'function'){ try{ editor.refresh(); if(typeof editor.focus === 'function') editor.focus(); }catch(e){} } }, 60);
        }
      }catch(e){}
    });
    mo.observe(authPanel, { attributes: true, attributeFilter: ['style'] });
  }catch(e){}
});

// initial render
renderAuth(); renderList();

// expose for debugging
window._APP = {USERS, docs};

// NOTE: 这是前端客户端实现，数据保存在用户浏览器的 localStorage 中，适合演示或小规模班级使用。若需多人共享（服务器端同步）我可以继续帮你接入后端 API。
