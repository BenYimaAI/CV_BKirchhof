(() => {
  'use strict';
  // UX gate only. This does not secure static site source or hosted HTML.
  const digest = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';
  const mailto = 'mailto:Benjamin.kapp@mercedes-benz.com?subject=' +
    encodeURIComponent('Request for interactive CV access - Benjamin Kapp Kirchhof') +
    '&body=' + encodeURIComponent('Hello Benjamin,\n\nI would like to request the access code for your interactive CV portfolio. Please send me the details when convenient.\n\nThank you and kind regards,\nA prospective visitor');
  const style = document.createElement('style');
  style.textContent = `
    body:not([data-cv-access="public"]) #view-public,
    body:not([data-cv-access="internal"]) #view-internal{visibility:hidden!important}
    .cv-email{font-size:.9rem;color:#55686b;line-height:1.6;margin:20px 0 0}
    .cv-email a,.cv-gate a{color:#876132;text-decoration:underline;text-underline-offset:4px}
    .cv-gate{width:min(445px,calc(100vw - 32px));max-height:calc(100dvh - 36px);overflow:auto;
       padding:clamp(22px,5vw,34px);border:1px solid #d3dfd8;border-radius:20px;
       background:#fff;color:#17252e;box-shadow:0 22px 80px #0a192a55;margin:auto}
    .cv-gate::backdrop{background:#061622b8;backdrop-filter:blur(4px)}
    .cv-gate h2{font-family:Georgia,serif;font-weight:400;font-size:clamp(1.9rem,5vw,2.45rem);line-height:1.1;margin:10px 0 15px}
    .cv-gate p{line-height:1.5;font-size:.91rem;color:#51636a}
    .cv-gate label{display:block;font-weight:700;margin:21px 0 8px}
    .cv-gate input{display:block;width:100%;padding:14px;font:inherit;min-height:50px;border:1px solid #b1c2c1;border-radius:10px}
    .cv-gate input:focus{outline:3px solid #dabf88;outline-offset:2px}
    .cv-gate-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
    .cv-gate-actions button{flex:1;justify-content:center}
    .cv-gate-error{color:#a0303a!important;min-height:1.3em;margin:7px 0 0}
    .cv-gate .cv-gate-note{color:#78868b;font-size:.74rem;margin:12px 0 0}
  `;
  document.head.append(style);
  const email = document.createElement('p');
  email.className = 'cv-email';
  const requestLink = document.createElement('a');
  requestLink.href = mailto;
  requestLink.textContent = 'Request the access code by email ↗';
  email.append('Need access? ',requestLink);
  document.querySelector('#view-choose .choose-wrap').append(email);

  const dialog = document.createElement('dialog');
  dialog.id = 'accessDialog';dialog.className = 'cv-gate';
  dialog.setAttribute('aria-labelledby','accessTitle');
  dialog.innerHTML = `
    <h2 id="accessTitle">Portfolio access</h2>
    <p>Enter the access code shared by Benjamin to continue.</p>
    <form id="accessForm">
      <label for="accessPassword">Access code</label>
      <input id="accessPassword" type="password" autocomplete="off" required>
      <p class="cv-gate-error" id="accessError" aria-live="polite"></p>
      <div class="cv-gate-actions">
        <button type="submit" class="btn">Continue →</button>
        <button type="button" class="btn secondary" id="cancelAccess">Cancel</button>
      </div>
    </form>
    <p class="cv-email"><a id="dialogMailLink">Request the access code ↗</a></p>
    <p class="cv-gate-note">This preview access gate is not a security control for sensitive information.</p>`;
  document.body.append(dialog);
  document.getElementById('dialogMailLink').href = mailto;
  const input = document.getElementById('accessPassword');
  const error = document.getElementById('accessError');
  let granted = null, pending = null;
  const modeFor = hash => hash === '#internal' ? 'internal' : hash.startsWith('#public') ? 'public' : null;
  const showGate = mode => {
    pending=mode;
    document.getElementById('accessTitle').textContent = mode==='internal'?'Leadership & Strategy access':'Public Portfolio access';
    input.value='';error.textContent='';
    if(!dialog.open)dialog.showModal();
    input.focus();
  };
  async function verify(text){
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')===digest;
  }
  function guardRoute(){
    const mode=modeFor(location.hash);
    if(!mode){granted=null;document.body.dataset.cvAccess='';return;}
    if(granted!==mode){
      document.body.dataset.cvAccess='';
      history.replaceState(null,'',location.pathname+location.search+'#choose');
      showGate(mode);
    }
  }
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');
    const mode=a&&modeFor(a.getAttribute('href')||'');
    if(!mode || granted===mode)return;
    e.preventDefault();
    document.body.dataset.cvAccess='';
    history.replaceState(null,'',location.pathname+location.search+'#choose');
    showGate(mode);
  },true);
  document.getElementById('accessForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const ok=await verify(input.value);
    if(!ok){error.textContent='Incorrect access code. Please try again.';input.focus();input.select();return;}
    granted=pending;
    document.body.dataset.cvAccess=granted;
    const destination=granted;
    pending=null;
    dialog.close();
    location.hash='#'+destination;
  });
  document.getElementById('cancelAccess').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    pending=null;
    if(!granted){document.body.dataset.cvAccess='';history.replaceState(null,'',location.pathname+location.search+'#choose');}
  });
  input.addEventListener('input',()=>error.textContent='');
  window.addEventListener('hashchange',guardRoute);
  guardRoute();
})();