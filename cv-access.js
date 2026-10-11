(() => {
  const digest = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';
  let allowed = '';
  async function check(value) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('') === digest;
  }
  document.addEventListener('click', async event => {
    const anchor = event.target.closest('a[href="#public"],a[href="#internal"]');
    if (!anchor) return;
    const target = anchor.getAttribute('href');
    if (allowed === target) return;
    event.preventDefault();
    const entered = window.prompt('Enter the access phrase');
    if (entered === null || !(await check(entered))) return;
    allowed = target;
    location.hash = target;
  }, true);
})();