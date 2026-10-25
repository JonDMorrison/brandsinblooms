(() => {
  const search = document.getElementById('feature-search');
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('#feature-results [data-feature]')];
  const groups = [...document.querySelectorAll('[data-group]')];
  const count = document.getElementById('feature-count');
  const empty = document.getElementById('no-results');
  const known = new Set(buttons.map(b => b.dataset.filter));
  let category = 'all';
  function apply(updateUrl = true) {
    const tokens = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    cards.forEach(card => {
      const match = (category === 'all' || card.dataset.category === category) && tokens.every(token => card.dataset.search.includes(token));
      card.hidden = !match;
      if (match) visible++;
    });
    groups.forEach(group => { group.hidden = ![...group.querySelectorAll('[data-feature]')].some(card => !card.hidden); });
    buttons.forEach(button => { button.setAttribute('aria-pressed', String(category === button.dataset.filter)); });
    count.textContent = `${visible} ${visible === 1 ? 'feature' : 'features'}${tokens.length || category !== 'all' ? ' found' : ' to explore'}`;
    empty.hidden = visible > 0;
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', category);
      if (search.value.trim()) url.searchParams.set('q', search.value.trim()); else url.searchParams.delete('q');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }
  function restore() {
    const query = new URLSearchParams(window.location.search);
    category = known.has(query.get('category')) ? query.get('category') : 'all';
    search.value = query.get('q') || '';
    apply(false);
  }
  if (search) {
    search.addEventListener('input', () => apply());
    buttons.forEach(button => button.addEventListener('click', () => { category = button.dataset.filter; apply(); }));
    document.querySelectorAll('[data-reset]').forEach(button => button.addEventListener('click', () => { category = 'all'; search.value = ''; apply(); search.focus(); }));
    window.addEventListener('popstate', restore);
    restore();
  }
  const dialog = document.getElementById('screenshot-dialog');
  let zoomTrigger;
  document.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click', () => {
    if (!dialog || !dialog.showModal) { window.open(button.dataset.zoom, '_blank', 'noopener'); return; }
    zoomTrigger = button;
    dialog.querySelector('img').src = button.dataset.zoom;
    dialog.showModal();
  }));
  if (dialog) {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => zoomTrigger?.focus());
  }
  document.querySelectorAll('.mobile-nav').forEach(menu => menu.addEventListener('keydown', event => { if(event.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();} }));
})();
