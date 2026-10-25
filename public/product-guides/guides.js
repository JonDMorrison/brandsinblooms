(() => {
  const finder = document.querySelector('[data-finder]');
  if (finder) {
    const search = finder.querySelector('#feature-search');
    const filters = [...finder.querySelectorAll('[data-filter]')];
    const cards = [...finder.querySelectorAll('[data-feature]')];
    const groups = [...finder.querySelectorAll('[data-group]')];
    const count = finder.querySelector('#feature-count');
    const empty = finder.querySelector('#no-results');
    const shortlist = finder.querySelector('.shortlist');
    const list = finder.querySelector('[data-shortlist-list]');
    const shortlistLink = finder.querySelector('[data-shortlist-link]');
    const shortlistCount = finder.querySelector('#shortlist-count');
    const addButtons = [...finder.querySelectorAll('[data-shortlist]')];
    const topics = new Map(addButtons.map(button => [button.dataset.shortlist, button.dataset.title]));
    const knownCategories = new Set(filters.map(button => button.dataset.filter));
    const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    const acronyms = new Set(['ai', 'sms', 'pos', 'csv', 'dns', 'sku']);
    const indexed = new Map(cards.map(card => { const text = normalize(card.dataset.search); return [card, { text, words: new Set(text.match(/[a-z0-9]+/g) || []) }]; }));
    let category = 'all';
    let selected = [];
    function saveUrl() {
      const url = new URL(location.href);
      if (search.value.trim()) url.searchParams.set('q', search.value.trim()); else url.searchParams.delete('q');
      if (category !== 'all') url.searchParams.set('category', category); else url.searchParams.delete('category');
      if (selected.length) url.searchParams.set('topics', selected.join(',')); else url.searchParams.delete('topics');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    function renderSelection(save = true) {
      shortlist.hidden = selected.length === 0;
      list.replaceChildren();
      for (const slug of selected) {
        const item = document.createElement('li');
        const title = document.createElement('span');
        title.textContent = topics.get(slug);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', `Remove ${topics.get(slug)} from demo shortlist`);
        remove.addEventListener('click', () => {
          selected = selected.filter(value => value !== slug);
          renderSelection();
          // The removed control no longer exists: return focus to a stable control.
          addButtons.find(button => button.dataset.shortlist === slug)?.focus();
        });
        item.append(title, remove);
        list.append(item);
      }
      shortlistCount.textContent = `${selected.length} of 6 topics selected. You can edit the enquiry before sending.`;
      const url = new URL(finder.dataset.contact, location.origin);
      if (selected.length) url.searchParams.set('topics', selected.join(','));
      shortlistLink.href = url.pathname + url.search;
      for (const button of addButtons) {
        const active = selected.includes(button.dataset.shortlist);
        button.setAttribute('aria-pressed', String(active));
        button.setAttribute('aria-label', `${active ? 'Remove' : 'Add'} ${button.dataset.title} ${active ? 'from' : 'to'} demo shortlist`);
        button.querySelector('span').textContent = active ? 'Added to demo shortlist' : 'Add to demo shortlist';
        button.disabled = !active && selected.length >= 6;
      }
      if (save) saveUrl();
    }
    function apply(save = true) {
      const tokens = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
      let visible = 0;
      cards.forEach(card => {
        const match = (category === 'all' || card.dataset.category === category) && tokens.every(token => acronyms.has(token) ? indexed.get(card).words.has(token) : indexed.get(card).text.includes(token));
        card.hidden = !match;
        if (match) visible++;
      });
      groups.forEach(group => { group.hidden = ![...group.querySelectorAll('[data-feature]')].some(card => !card.hidden); });
      filters.forEach(button => button.setAttribute('aria-pressed', String(category === button.dataset.filter)));
      count.textContent = `${visible} ${visible === 1 ? 'feature' : 'features'}${tokens.length || category !== 'all' ? ' found' : ' to explore'}`;
      empty.hidden = visible > 0;
      if (save) saveUrl();
    }
    function restore() {
      const params = new URLSearchParams(location.search);
      category = knownCategories.has(params.get('category')) ? params.get('category') : 'all';
      search.value = (params.get('q') || '').slice(0, 160);
      selected = [...new Set((params.get('topics') || '').split(','))].filter(slug => topics.has(slug)).slice(0, 6);
      apply(false);
      renderSelection(false);
    }
    search.maxLength = 160;
    search.addEventListener('input', () => apply());
    filters.forEach(button => button.addEventListener('click', () => { category = button.dataset.filter; apply(); }));
    finder.querySelector('[data-reset]').addEventListener('click', () => { category = 'all'; search.value = ''; apply(); search.focus(); });
    addButtons.forEach(button => button.addEventListener('click', () => {
      const slug = button.dataset.shortlist;
      if (selected.includes(slug)) selected = selected.filter(value => value !== slug);
      else if (selected.length < 6) selected.push(slug);
      renderSelection();
    }));
    finder.querySelector('[data-shortlist-clear]').addEventListener('click', () => { selected = []; renderSelection(); search.focus(); });
    window.addEventListener('popstate', restore);
    restore();
  }
  document.querySelectorAll('[data-print]').forEach(button => button.addEventListener('click', () => window.print()));
  const menus = [...document.querySelectorAll('.product-menu, .mobile-menu')];
  menus.forEach(menu => {
    menu.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); } });
    menu.addEventListener('toggle', () => { if (menu.open) menus.filter(other => other !== menu).forEach(other => { other.open = false; }); });
  });
  document.addEventListener('click', event => menus.forEach(menu => { if (!menu.contains(event.target)) menu.open = false; }));
})();
