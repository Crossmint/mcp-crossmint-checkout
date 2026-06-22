import { BASKET_MODEL_FIELD_GUIDE } from "./schema.js";

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function renderBasketViewerHtml(): string {
  const modelFields = safeJson(BASKET_MODEL_FIELD_GUIDE);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Basket</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f3;
      --surface: #ffffff;
      --ink: #17201b;
      --muted: #66716b;
      --line: #d9dfd7;
      --green: #146b4a;
      --green-ink: #effaf3;
      --blue: #2c5f9e;
      --amber: #9b6515;
      --red: #9f2d2d;
      --shadow: 0 14px 40px rgba(20, 31, 26, 0.08);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    button, input, select { font: inherit; }

    .app {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      min-height: 100vh;
    }

    main {
      padding: 28px;
      min-width: 0;
    }

    aside {
      border-left: 1px solid var(--line);
      background: #fbfcf8;
      padding: 24px;
      min-width: 0;
    }

    .topbar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 22px;
    }

    h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.1;
      font-weight: 750;
    }

    .intent {
      margin: 8px 0 0;
      color: var(--muted);
      max-width: 840px;
      line-height: 1.45;
    }

    .actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
    }

    .icon-button {
      width: 38px;
      height: 38px;
      border-radius: 7px;
      border: 1px solid var(--line);
      background: var(--surface);
      color: var(--ink);
      cursor: pointer;
      box-shadow: 0 1px 1px rgba(0,0,0,0.03);
    }

    .icon-button:hover { border-color: #aeb8af; }

    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(130px, 1fr));
      gap: 12px;
      margin-bottom: 22px;
    }

    .stat {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px 16px;
      box-shadow: 0 1px 1px rgba(0,0,0,0.02);
      min-height: 80px;
    }

    .stat span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
    }

    .stat strong {
      display: block;
      margin-top: 8px;
      font-size: 24px;
      line-height: 1;
    }

    .items {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 14px;
    }

    .item {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr);
      gap: 14px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      min-height: 168px;
      box-shadow: var(--shadow);
    }

    .thumb {
      width: 112px;
      height: 144px;
      border-radius: 7px;
      background: #e8ece5;
      border: 1px solid #d1d8d0;
      overflow: hidden;
      display: grid;
      place-items: center;
      color: var(--muted);
      font-size: 12px;
      text-align: center;
    }

    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .item-body {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .item-title {
      margin: 0;
      font-size: 16px;
      line-height: 1.25;
      font-weight: 720;
      overflow-wrap: anywhere;
    }

    .meta, .reason, .locator {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .price-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .price {
      font-size: 18px;
      font-weight: 760;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      height: 24px;
      border-radius: 999px;
      padding: 0 9px;
      font-size: 12px;
      border: 1px solid var(--line);
      background: #f8faf6;
      color: var(--muted);
      max-width: 100%;
    }

    .pill.ready { background: #e8f5ee; color: var(--green); border-color: #b8ddc9; }
    .pill.review { background: #fff6df; color: var(--amber); border-color: #efd18b; }
    .pill.rejected { background: #fdeeee; color: var(--red); border-color: #e5b7b7; }

    .item-controls {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      margin-top: auto;
    }

    .item-controls button {
      height: 32px;
      border: 1px solid var(--line);
      background: #fbfcf9;
      border-radius: 7px;
      cursor: pointer;
      color: var(--ink);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .item-controls button:hover { border-color: #aeb8af; }

    .item-controls .primary {
      background: var(--green);
      color: var(--green-ink);
      border-color: var(--green);
    }

    .panel-title {
      margin: 0 0 14px;
      font-size: 14px;
      text-transform: uppercase;
      color: var(--muted);
    }

    .model-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 26px;
      padding: 0;
      list-style: none;
    }

    .model-list li {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 7px 10px;
      background: var(--surface);
      color: var(--muted);
      font-size: 12px;
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    .status-table {
      display: grid;
      gap: 8px;
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      border-bottom: 1px solid var(--line);
      padding: 9px 0;
      color: var(--muted);
    }

    .status-row strong { color: var(--ink); }

    .empty {
      border: 1px dashed #bcc7bd;
      border-radius: 8px;
      background: rgba(255,255,255,0.55);
      padding: 34px;
      color: var(--muted);
      text-align: center;
    }

    @media (max-width: 980px) {
      .app { grid-template-columns: 1fr; }
      aside { border-left: 0; border-top: 1px solid var(--line); }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 620px) {
      main, aside { padding: 18px; }
      .topbar { flex-direction: column; }
      .stats { grid-template-columns: 1fr; }
      .items { grid-template-columns: 1fr; }
      .item { grid-template-columns: 92px minmax(0, 1fr); }
      .thumb { width: 92px; height: 124px; }
      .item-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
  <div class="app">
    <main>
      <header class="topbar">
        <div>
          <h1 id="title">Agent Basket</h1>
          <p class="intent" id="intent"></p>
        </div>
        <div class="actions">
          <button class="icon-button" id="refresh" title="Refresh" aria-label="Refresh">R</button>
        </div>
      </header>

      <section class="stats" aria-label="Basket stats">
        <div class="stat"><span>Items</span><strong id="stat-items">0</strong></div>
        <div class="stat"><span>Ready</span><strong id="stat-ready">0</strong></div>
        <div class="stat"><span>Missing locator</span><strong id="stat-missing">0</strong></div>
        <div class="stat"><span>Total</span><strong id="stat-total">-</strong></div>
      </section>

      <section class="items" id="items"></section>
    </main>

    <aside>
      <h2 class="panel-title">Model</h2>
      <ul class="model-list" id="model-list"></ul>

      <h2 class="panel-title">Statuses</h2>
      <div class="status-table" id="status-table"></div>
    </aside>
  </div>

  <script>
    window.MODEL_FIELDS = ${modelFields};

    const state = { basket: null };

    function text(value, fallback) {
      return value == null || value === '' ? fallback : value;
    }

    function money(value) {
      if (!value) return '-';
      if (value.display) return value.display;
      if (value.amount == null) return '-';
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: value.currency || 'USD'
        }).format(value.amount);
      } catch {
        return String(value.amount) + ' ' + (value.currency || '');
      }
    }

    function statusClass(status) {
      if (status === 'approved' || status === 'ready_for_checkout' || status === 'ordered') return 'ready';
      if (status === 'needs_review' || status === 'shortlisted') return 'review';
      if (status === 'rejected') return 'rejected';
      return '';
    }

    function totalText(totals) {
      const entries = Object.entries(totals || {});
      if (entries.length === 0) return '-';
      return entries.map(function(entry) {
        return money({ amount: entry[1], currency: entry[0] });
      }).join(' + ');
    }

    function renderModel() {
      const list = document.getElementById('model-list');
      list.innerHTML = window.MODEL_FIELDS.map(function(field) {
        return '<li>' + field.replace(/^product\\./, '') + '</li>';
      }).join('');
    }

    function renderStatuses(basket) {
      const table = document.getElementById('status-table');
      const statuses = basket.statuses || {};
      const entries = Object.keys(statuses).sort().map(function(key) {
        return '<div class="status-row"><span>' + key + '</span><strong>' + statuses[key] + '</strong></div>';
      });
      table.innerHTML = entries.length === 0 ? '<div class="status-row"><span>empty</span><strong>0</strong></div>' : entries.join('');
    }

    function renderItem(item) {
      const merchant = item.merchant && (item.merchant.name || item.merchant.domain) ? (item.merchant.name || item.merchant.domain) : 'Unknown merchant';
      const readiness = item.checkout && item.checkout.readiness ? item.checkout.readiness : 'unknown';
      const image = item.image ? '<img src="' + item.image + '" alt="">' : 'No image';
      const sourceLink = item.url ? '<a href="' + item.url + '" target="_blank" rel="noreferrer">' + merchant + '</a>' : merchant;
      return [
        '<article class="item" data-id="' + item.id + '">',
          '<div class="thumb">' + image + '</div>',
          '<div class="item-body">',
            '<h3 class="item-title">' + text(item.title, 'Untitled product') + '</h3>',
            '<p class="meta">' + sourceLink + ' · Qty ' + item.quantity + '</p>',
            '<div class="price-row">',
              '<span class="price">' + money(item.price) + '</span>',
              '<span class="pill ' + statusClass(item.status) + '">' + item.status + '</span>',
              '<span class="pill">' + readiness + '</span>',
            '</div>',
            '<p class="reason">' + text(item.reason, 'No rationale captured yet.') + '</p>',
            '<p class="locator">' + text(item.locator, 'No checkout locator') + '</p>',
            '<div class="item-controls">',
              '<button data-action="status" data-status="candidate">Candidate</button>',
              '<button data-action="status" data-status="shortlisted">Shortlist</button>',
              '<button class="primary" data-action="status" data-status="approved">Approve</button>',
              '<button data-action="status" data-status="rejected">Reject</button>',
            '</div>',
          '</div>',
        '</article>'
      ].join('');
    }

    function render(basket) {
      state.basket = basket;
      const context = basket.context || {};
      document.getElementById('title').textContent = context.title || 'Agent Basket';
      document.getElementById('intent').textContent = context.intent || 'Neutral pre-checkout workspace for purchase candidates.';
      document.getElementById('stat-items').textContent = basket.itemCount || 0;
      document.getElementById('stat-ready').textContent = basket.checkoutReady || 0;
      document.getElementById('stat-missing').textContent = basket.missingCheckoutLocator || 0;
      document.getElementById('stat-total').textContent = totalText(basket.totalsByCurrency);
      const items = document.getElementById('items');
      items.innerHTML = basket.items && basket.items.length
        ? basket.items.map(renderItem).join('')
        : '<div class="empty">No products in the basket.</div>';
      renderStatuses(basket);
    }

    async function loadBasket() {
      const response = await fetch('/api/basket', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load basket');
      render(await response.json());
    }

    async function updateStatus(id, status) {
      const response = await fetch('/api/items/' + encodeURIComponent(id) + '/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status })
      });
      if (!response.ok) throw new Error('Failed to update status');
      await loadBasket();
    }

    document.addEventListener('click', function(event) {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.id === 'refresh') {
        loadBasket();
        return;
      }
      const action = button.getAttribute('data-action');
      if (action === 'status') {
        const item = button.closest('.item');
        updateStatus(item.getAttribute('data-id'), button.getAttribute('data-status'));
      }
    });

    renderModel();
    loadBasket();
    setInterval(loadBasket, 5000);
  </script>
</body>
</html>`;
}
