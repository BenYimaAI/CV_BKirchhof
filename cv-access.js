(() => {
  'use strict';

  // Decrypts the three registers in the browser. The access code is not in
  // this file. private/registers.enc.json holds AES-256-GCM ciphertext only.
  const AAD = 'cv-private-v1';
  const VAULT = 'private/registers.enc.json';
  const MIN_ITERATIONS = 100000;
  const MAX_ITERATIONS = 2000000;

  const copyNode = document.getElementById('publicCopy');
  const translations = copyNode ? JSON.parse(copyNode.textContent) : {};
  let currentLang = localStorage.getItem('cv_lang') || 'en';
  if (!translations[currentLang]) currentLang = 'en';
  let pendingRoute = null;
  let returnFocus = null;
  let operation = 0;
  let privateKeys = [];
  let vaultPromise = null;

  const routeMeta = {
    cv: {labelKey: 'pathCV', accent: ['var(--cv1)', 'var(--cv2)']},
    projects: {labelKey: 'pathProj', accent: ['var(--proj1)', 'var(--proj2)']},
    private: {labelKey: 'pathPriv', accent: ['var(--priv1)', 'var(--priv2)']}
  };

  const input = document.getElementById('pwdInput');
  const error = document.getElementById('pwdError');
  const status = document.getElementById('pwdStatus');
  const openBtn = document.getElementById('openBtn');
  const dialog = document.getElementById('dialog');

  function t(key) {
    return (translations[currentLang] && translations[currentLang][key]) || key;
  }

  function b64ToBytes(value) {
    const bin = atob(value);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }

  function loadVault() {
    if (!vaultPromise) {
      vaultPromise = fetch(new URL(VAULT, document.baseURI), {cache: 'no-store'}).then((response) => {
        if (!response.ok) throw Object.assign(new Error('load'), {code: 'unavailable'});
        return response.json();
      }).catch((cause) => {
        vaultPromise = null;
        if (cause && cause.code === 'unavailable') throw cause;
        throw Object.assign(new Error('load'), {code: 'unavailable'});
      });
    }
    return vaultPromise;
  }

  async function decryptVault(code) {
    const vault = await loadVault();
    const iterations = vault.iterations;
    if (vault.version !== 1 || vault.kdf !== 'PBKDF2-SHA-256' || vault.aad !== AAD) {
      throw Object.assign(new Error('vault'), {code: 'unavailable'});
    }
    if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
      throw Object.assign(new Error('vault'), {code: 'unavailable'});
    }
    const salt = b64ToBytes(vault.salt);
    const iv = b64ToBytes(vault.iv);
    const ciphertext = b64ToBytes(vault.ciphertext);
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(code),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      {name: 'PBKDF2', salt, iterations, hash: 'SHA-256'},
      baseKey,
      {name: 'AES-GCM', length: 256},
      false,
      ['decrypt']
    );
    let plain;
    try {
      plain = await crypto.subtle.decrypt(
        {name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(AAD)},
        key,
        ciphertext
      );
    } catch {
      throw Object.assign(new Error('auth'), {code: 'rejected'});
    }
    const payload = JSON.parse(new TextDecoder().decode(plain));
    if (!payload.views || !payload.views.cv || !payload.views.projects || !payload.views.private) {
      throw Object.assign(new Error('shape'), {code: 'unavailable'});
    }
    return payload;
  }

  function mergePrivate(table) {
    privateKeys = [];
    for (const [lang, entries] of Object.entries(table || {})) {
      translations[lang] = translations[lang] || {};
      for (const [key, value] of Object.entries(entries)) {
        translations[lang][key] = value;
        if (!privateKeys.includes(key)) privateKeys.push(key);
      }
    }
  }

  function dropPrivate() {
    for (const lang of Object.keys(translations)) {
      for (const key of privateKeys) delete translations[lang][key];
    }
    privateKeys = [];
  }

  function clearRegisters() {
    const mount = document.getElementById('registerMount');
    if (mount) mount.textContent = '';
    dropPrivate();
  }

  function mountRegisters(views) {
    const mount = document.getElementById('registerMount');
    mount.innerHTML = views.cv + views.projects + views.private;
  }

  function applyLang(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('cv_lang', lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
    document.querySelectorAll('[data-t]').forEach((el) => {
      const key = el.dataset.t;
      if (translations[lang][key]) el.textContent = translations[lang][key];
    });
    document.querySelectorAll('[data-ph]').forEach((el) => {
      const key = el.dataset.ph;
      if (translations[lang][key]) el.placeholder = translations[lang][key];
    });
    document.querySelectorAll('[data-lang]').forEach((button) => {
      button.classList.toggle('active', button.dataset.lang === lang);
    });
    const subject = encodeURIComponent('Request access code for Benjamin Kirchhof portfolio');
    const body = encodeURIComponent('Hello Benjamin,\r\n\r\nI would like to request the access code for your protected portfolio.\r\nRequested register(s): CV / Motivation, Projects / Achievements, Private Life / Hobbies\r\n\r\nThank you.');
    const mail = document.getElementById('requestAccessLink');
    if (mail) mail.href = `mailto:Benjamin.kapp@mercedes-benz.com?subject=${subject}&body=${body}`;
    const tag = document.getElementById('activeRegisterTag');
    if (tag && tag.dataset.route && routeMeta[tag.dataset.route]) {
      tag.textContent = translations[lang][routeMeta[tag.dataset.route].labelKey];
    }
  }

  function setBusy(busy) {
    openBtn.disabled = busy;
    input.disabled = busy;
    openBtn.textContent = busy ? t('pwdWorking') : t('pwdButton');
    if (status) status.textContent = busy ? t('pwdWorking') : '';
  }

  function openDialog(route, trigger) {
    pendingRoute = route;
    returnFocus = trigger || document.activeElement;
    dialog.classList.add('show');
    dialog.setAttribute('aria-hidden', 'false');
    input.value = '';
    error.textContent = '';
    if (status) status.textContent = '';
    openBtn.style.background = `linear-gradient(90deg,${routeMeta[route].accent[0]},${routeMeta[route].accent[1]})`;
    setTimeout(() => input.focus(), 60);
  }

  function closeDialog() {
    operation += 1;
    setBusy(false);
    dialog.classList.remove('show');
    dialog.setAttribute('aria-hidden', 'true');
    input.value = '';
  }

  function showRoute(route) {
    document.getElementById('protectedArea').hidden = false;
    document.querySelectorAll('.regView').forEach((view) => view.classList.remove('active'));
    document.getElementById('view-' + route).classList.add('active');
    const tag = document.getElementById('activeRegisterTag');
    tag.dataset.route = route;
    tag.textContent = translations[currentLang][routeMeta[route].labelKey];
    document.getElementById('protectedArea').scrollIntoView({behavior: 'smooth', block: 'start'});
    const back = document.getElementById('backHome');
    if (back) back.focus();
  }

  function backHome() {
    operation += 1;
    document.getElementById('protectedArea').hidden = true;
    clearRegisters();
    const tag = document.getElementById('activeRegisterTag');
    if (tag) delete tag.dataset.route;
    document.getElementById('gateway').scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', () => applyLang(button.dataset.lang));
  });
  document.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => openDialog(button.dataset.route, button));
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    closeDialog();
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  });
  document.getElementById('backHome').addEventListener('click', backHome);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      closeDialog();
      if (returnFocus && returnFocus.focus) returnFocus.focus();
    }
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') openBtn.click();
  });
  input.addEventListener('input', () => {
    error.textContent = '';
  });

  openBtn.addEventListener('click', async () => {
    const code = input.value.trim();
    const route = pendingRoute;
    if (!code || !route) {
      error.textContent = t('pwdError');
      input.focus();
      return;
    }
    const token = operation + 1;
    operation = token;
    setBusy(true);
    error.textContent = '';
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (token !== operation) return;
    try {
      const payload = await decryptVault(code);
      if (token !== operation) return;
      clearRegisters();
      mergePrivate(payload.translations);
      mountRegisters(payload.views);
      applyLang(currentLang);
      closeDialog();
      showRoute(route);
    } catch (cause) {
      if (token !== operation) return;
      setBusy(false);
      error.textContent = cause && cause.code === 'unavailable' ? t('pwdUnavailable') : t('pwdError');
      input.focus();
      input.select();
    }
  });

  applyLang(currentLang);
})();
