/* Token Radar's dashboard: the board, the live-token view, the model, and the detail view.
   Everything it renders comes from window.RADAR, the dataset this repository's main.ts writes.
   The model below is the same one lib/model.ts runs: the detail view recomputes every row's
   implied value from the row's own figures, and shows a checkmark when it matches the board. */

const DATA = window.RADAR;
const MODEL = DATA.model;
const ROWS = DATA.rows;
const LIVE = DATA.live;

/* ---------- formatting ---------- */

const fmtUsd = (n) => {
  if (n === null || n === undefined) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
};

const fmtPct = (n) => {
  if (n === null || n === undefined) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
};

const fmtAge = (days) => {
  if (days === null || days === undefined) return 'unknown';
  if (days < 365) return `${days}d`;
  const years = days / 365;
  return `${years >= 10 ? Math.round(years) : years.toFixed(1)}y`;
};

const fmtMult = (n) => `${n.toFixed(3)}×`;
const fmtChains = (chains) => chains.length ? chains.join(' · ') : '—';
const bySlug = (slug) => ROWS.find((r) => r.slug === slug);
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

/* ---------- the model, again: one row's implied value from its own figures ---------- */

function impliedOf(row) {
  const age = row.age_days ?? MODEL.unknown_age_days;
  const growth = Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, row.change_7d ?? 0));
  const weight = growth >= 0 ? MODEL.growth_weight_up : MODEL.growth_weight_down;
  const growthMult = 1 + (growth / 100) * weight;
  const maturity = MODEL.maturity_floor + (Math.min(Math.max(age, 0), MODEL.maturity_days) / MODEL.maturity_days) * MODEL.maturity_range;
  const young = row.age_days !== null && row.age_days < MODEL.young_age_days ? MODEL.young_discount : 1;
  const breadth = 1 + MODEL.breadth_step * Math.min(Math.max(row.chains.length - 1, 0), MODEL.breadth_max_chains);
  return { implied: Math.max(1, Math.round(row.tvl_usd * row.category_multiple * growthMult * maturity * young * breadth)), growth, growthMult, maturity, young, breadth };
}

/* ---------- the farm plan, again: the same seven steps lib/model.ts writes ---------- */

function gasFor(chain) {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 12;
  if (c === 'solana') return 0.1;
  if (c === 'base' || c === 'arbitrum' || c === 'optimism' || c === 'polygon' || c === 'hyperliquid l1') return 0.5;
  if (c === 'binance') return 0.3;
  if (c === 'avalanche') return 0.8;
  if (c === 'bitcoin') return 3;
  if (c === 'tron') return 1;
  return 2;
}
const gasUsd = (n) => `$${n % 1 === 0 ? String(n) : n.toFixed(2)}`;
function capitalFor(row) {
  if (row.tvl_usd >= 5e9) return 500;
  if (row.tvl_usd >= 1e9) return 250;
  if (row.tvl_usd >= 1e8) return 100;
  return 50;
}
function holdDaysFor(age) {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}
function actionFor(row, capital, chain) {
  const c = (row.category ?? '').toLowerCase();
  const name = row.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('indexes') || c.includes('index')) return `Buy $${capital} of the ${name} index on ${chain} and hold the tokens.`;
  if (c.includes('basis')) return `Deposit $${capital} into the ${name} basis vault on ${chain} and keep the shares.`;
  if (c.includes('payment')) return `Route $${capital} of USDC through ${name} on ${chain} and keep the receipt.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}
function secondActionFor(row, chain) {
  const c = (row.category ?? '').toLowerCase();
  const name = row.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $20 of USDC against the deposit and repay it the same week, so the account shows borrowing as well as supply.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Swap $10 through the pool so the position records a trade as well as liquidity.`;
  if (c.includes('bridge')) return `Bridge $10 back along the same route so the account shows volume in both directions.`;
  if (c.includes('staking') || c.includes('restak')) return `Restake the receipt token once, if the protocol offers it, and keep the new receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Close the hedge and open it once more, so the account shows two fills instead of one.`;
  if (c.includes('prediction')) return `Settle the first position and place a second, smaller one on a different market.`;
  if (c.includes('curator') || c.includes('allocator')) return `Move $10 into a second vault of ${name} so the account touches more than one product.`;
  if (c.includes('stable')) return `Redeem $10 of the stable asset and mint it again, so the account shows both directions.`;
  if (c.includes('rwa')) return `Claim the yield the position earned so far, if any, and leave the principal in place.`;
  if (c.includes('insurance')) return `Read the cover terms on ${name}'s own page and note the claim window before it closes.`;
  return `Make a second small deposit of $10 into the same position on ${chain}.`;
}
function farmSteps(row) {
  const chain = row.chains.length ? row.chains[0] : 'its main chain';
  const secondChain = row.chains.length > 1 ? row.chains[1] : null;
  const capital = capitalFor(row);
  const hold = holdDaysFor(row.age_days);
  const gas = gasUsd(gasFor(chain));
  const secondGas = secondChain === null ? gas : gasUsd(gasFor(secondChain));
  const steps = [
    { text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`, cost: `under $3 of gas for the first transaction on ${chain}`, time: '5 minutes' },
    { text: actionFor(row, capital, chain), cost: `$${capital} of capital and about ${gas} of gas`, time: '15 minutes to set up' },
    { text: secondChain === null ? secondActionFor(row, chain) : `Repeat the deposit on ${secondChain} with $25, so the account is active on two chains.`, cost: secondChain === null ? `about ${gas} of gas` : `$25 of capital and about ${secondGas} of gas`, time: '10 minutes' },
    { text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`, cost: `about ${gas} of gas a week`, time: '10 minutes a week' },
    { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: `the $${capital} stays in the position`, time: `${hold} days` },
    { text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
    { text: `Write the wallet, the dates and every transaction in a farm log, then unwind in reverse: claim, withdraw, and leave $1 of dust behind.`, cost: `about ${gas} of gas to exit`, time: '10 minutes to close out' },
  ];
  return steps.map((s) => {
    let out = `${s.text} Cost: ${s.cost}. Time: ${s.time}.`;
    if (out.length > 600) out = `${out.slice(0, 596)}...`;
    if (out.length < 20) out = `${out} Hold the position and check the protocol's own page.`;
    return out;
  });
}

/* ---------- state, in the address bar so a view can be linked ---------- */

const SORTS = [
  { key: 'implied', label: 'Implied value' },
  { key: 'tvl', label: 'TVL' },
  { key: 'growth', label: '7d change' },
  { key: 'age', label: 'Age' },
  { key: 'name', label: 'Name' },
  { key: 'multiple', label: 'Category multiple' },
];
const SORT_FNS = {
  implied: (a, b) => a.implied_value_usd - b.implied_value_usd,
  tvl: (a, b) => a.tvl_usd - b.tvl_usd,
  growth: (a, b) => (a.change_7d ?? -Infinity) - (b.change_7d ?? -Infinity),
  age: (a, b) => (a.age_days ?? -1) - (b.age_days ?? -1),
  name: (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  multiple: (a, b) => a.category_multiple - b.category_multiple,
};

function readHash() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    chain: params.get('chain') ?? '',
    watchlist: params.get('watchlist') === '1',
    tab: params.get('tab') === 'live' ? 'live' : 'board',
    sort: SORTS.some((s) => s.key === params.get('sort')) ? params.get('sort') : 'implied',
    dir: params.get('dir') === 'asc' ? 'asc' : 'desc',
    selected: params.get('p') ?? '',
  };
}
let state = readHash();

function writeHash() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.chain) params.set('chain', state.chain);
  if (state.watchlist) params.set('watchlist', '1');
  if (state.tab === 'live') params.set('tab', 'live');
  if (state.sort !== 'implied') params.set('sort', state.sort);
  if (state.dir === 'asc') params.set('dir', 'asc');
  if (state.selected) params.set('p', state.selected);
  const next = params.toString();
  history.replaceState(null, '', next ? `#${next}` : window.location.pathname + window.location.search);
}

/* ---------- filtering and sorting ---------- */

function filteredRows() {
  const q = state.q.trim().toLowerCase();
  return ROWS.filter((r) => {
    if (state.category && r.category !== state.category) return false;
    if (state.chain && !r.chains.includes(state.chain)) return false;
    if (state.watchlist && !r.watchlist) return false;
    if (q && !(`${r.name} ${r.slug} ${r.category ?? ''}`.toLowerCase().includes(q))) return false;
    return true;
  });
}
function sortedRows(rows) {
  const dir = state.dir === 'asc' ? 1 : -1;
  const base = SORT_FNS[state.sort];
  return [...rows].sort((a, b) => dir * base(a, b) || a.slug.localeCompare(b.slug));
}
const CATEGORIES = [...new Set(ROWS.map((r) => r.category).filter(Boolean))].sort();
const CHAINS = [...new Set(ROWS.flatMap((r) => r.chains))].sort();

/* ---------- small render helpers ---------- */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const el = (tag, className, html) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

/* ---------- the page ---------- */

function headerEl() {
  const wrap = el('header', 'top');
  wrap.innerHTML = `
    <div class="brand"><span class="mark" aria-hidden="true"></span><span class="brand-name">token radar · ${esc(DATA.model_version)}</span></div>
    <div class="top-meta" aria-label="Snapshot facts">
      <span>Snapshot ${esc(DATA.as_of)}</span>
      <span>${esc(DATA.source)}</span>
      <span>Floor ${fmtUsd(DATA.floor_usd)}</span>
      <span>Board ${DATA.board_size} rows</span>
    </div>`;
  return wrap;
}

function ledeEl() {
  const wrap = el('section', 'lede');
  const top = ROWS[0];
  const earlyTop = ROWS.filter((r) => !r.watchlist)[0];
  const total = ROWS.reduce((s, r) => s + r.implied_value_usd, 0);
  wrap.innerHTML = `
    <div>
      <h1>The token launch radar.</h1>
      <p><strong>${DATA.board_size} pre-token protocols</strong>, ranked by the implied value of the token each might one day
      issue. Every value on this page comes from the same snapshot: total value locked, the last seven days of growth,
      and how long each protocol has run with no token. No token recorded, no market cap, no CoinGecko entry —
      a protocol with a live token is kept apart, in the Live tokens tab, and never mixed into the ranking.</p>
      <p>The ranking favours scale, but it is not a TVL table: a category's own live comparables set its multiple, a shrinking
      protocol keeps most of its base, and a young one pays a discount for a thin track record. Click any row for the
      working behind its number and a farm plan with costs and times.</p>
    </div>
    <div class="facts" aria-label="Board facts">
      <div class="fact"><span>Top implied value</span><b>${fmtUsd(top.implied_value_usd)} · ${esc(top.name)}</b></div>
      <div class="fact"><span>Top early find</span><b>${earlyTop ? `${fmtUsd(earlyTop.implied_value_usd)} · ${esc(earlyTop.name)}` : '—'}</b></div>
      <div class="fact"><span>Board implied value, total</span><b>${fmtUsd(total)}</b></div>
      <div class="fact"><span>Watchlist · early</span><b>${DATA.watchlist_size} · ${DATA.early_size}</b></div>
      <div class="fact"><span>Live tokens set aside</span><b>${DATA.live_size}</b></div>
    </div>`;
  return wrap;
}

function topTenEl() {
  const top = ROWS.slice(0, 10);
  const max = top[0].implied_value_usd;
  const section = el('section', 'panel topten');
  section.setAttribute('aria-label', 'Top ten by implied value');
  section.innerHTML = `
    <h2>Top ten by implied value</h2>
    <p class="sub">The first ten rows, bars scaled to the leader. The full board is below.</p>
    <ol>
      ${top.map((r) => `
        <li>
          <span class="rank">#${r.rank}</span>
          <span class="tname"><a href="#p=${encodeURIComponent(r.slug)}" data-open="${esc(r.slug)}">${esc(r.name)}</a></span>
          <span class="tbar"><i style="width:${(100 * r.implied_value_usd / max).toFixed(1)}%"></i></span>
          <span class="tval">${fmtUsd(r.implied_value_usd)}</span>
        </li>`).join('')}
    </ol>`;
  return section;
}

function controlsEl(count) {
  const wrap = el('div', 'controls');
  wrap.innerHTML = `
    <div class="field"><label for="q">Search</label><input id="q" type="search" placeholder="Name, slug or category" value="${esc(state.q)}" autocomplete="off"></div>
    <div class="field"><label for="category">Category</label><select id="category">
      <option value="">All categories</option>
      ${CATEGORIES.map((c) => `<option value="${esc(c)}" ${state.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
    </select></div>
    <div class="field"><label for="chain">Chain</label><select id="chain">
      <option value="">All chains</option>
      ${CHAINS.map((c) => `<option value="${esc(c)}" ${state.chain === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
    </select></div>
    <label class="check"><input id="watchlist" type="checkbox" ${state.watchlist ? 'checked' : ''}> Watchlist only</label>
    <div class="tabs" role="group" aria-label="Board or live tokens">
      <button type="button" data-tab="board" aria-pressed="${state.tab === 'board'}">Ranked board</button>
      <button type="button" data-tab="live" aria-pressed="${state.tab === 'live'}">Live tokens · ${DATA.live_size}</button>
    </div>
    <span class="count" aria-live="polite">${count} of ${DATA.board_size} rows</span>`;
  wrap.querySelector('#q').addEventListener('input', (e) => { state.q = e.target.value; state.selected = ''; writeHash(); render(false); });
  wrap.querySelector('#category').addEventListener('change', (e) => { state.category = e.target.value; writeHash(); render(false); });
  wrap.querySelector('#chain').addEventListener('change', (e) => { state.chain = e.target.value; writeHash(); render(false); });
  wrap.querySelector('#watchlist').addEventListener('change', (e) => { state.watchlist = e.target.checked; writeHash(); render(false); });
  wrap.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; writeHash(); render(false); }));
  return wrap;
}

function boardTable(rows) {
  const wrap = el('div', 'table-wrap');
  const max = ROWS[0].implied_value_usd;
  const sortButton = (key) => {
    const s = SORTS.find((x) => x.key === key);
    const arrow = state.sort === key ? (state.dir === 'desc' ? ' ↓' : ' ↑') : '';
    return `<button type="button" data-sort="${key}" aria-label="Sort by ${esc(s.label)}">${esc(s.label)}${arrow}</button>`;
  };
  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>#</th><th>${sortButton('name')}</th><th>${sortButton('implied')}</th><th>${sortButton('tvl')}</th>
        <th>${sortButton('multiple')}</th><th>${sortButton('growth')}</th><th>${sortButton('age')}</th><th>Chains</th><th></th>
      </tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr data-slug="${esc(r.slug)}" data-selected="${state.selected === r.slug}">
            <td class="num">${r.rank}</td>
            <td><div class="name"><b>${esc(r.name)}</b><span class="sub">${esc(r.category ?? '—')} · ${esc(r.slug)}</span></div></td>
            <td><div class="implied"><span class="num">${fmtUsd(r.implied_value_usd)}</span><span class="bar"><i style="width:${Math.max(2, 100 * r.implied_value_usd / max).toFixed(1)}%"></i></span></div></td>
            <td class="num">${fmtUsd(r.tvl_usd)}</td>
            <td class="num">${fmtMult(r.category_multiple)}</td>
            <td class="num ${r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'}">${fmtPct(r.change_7d)}</td>
            <td class="num">${fmtAge(r.age_days)}</td>
            <td class="sub">${esc(fmtChains(r.chains))}</td>
            <td>${r.watchlist ? '<span class="badge watch">WATCHLIST</span>' : '<span class="badge early">EARLY</span>'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  wrap.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
    if (state.sort === b.dataset.sort) state.dir = state.dir === 'desc' ? 'asc' : 'desc';
    else { state.sort = b.dataset.sort; state.dir = 'desc'; }
    writeHash(); render(false);
  }));
  wrap.querySelectorAll('tbody tr').forEach((tr) => tr.addEventListener('click', () => { state.selected = tr.dataset.slug; writeHash(); render(false); }));
  return wrap;
}

function liveTable() {
  const wrap = el('div', 'table-wrap');
  wrap.innerHTML = `
    <table>
      <thead><tr><th>Protocol</th><th>Market cap</th><th>TVL</th><th>mcap / TVL</th><th>7d</th><th>Chains</th><th></th></tr></thead>
      <tbody>
        ${LIVE.map((p) => `
          <tr data-slug="">
            <td><div class="name"><b>${esc(p.name)}</b><span class="sub">${esc(p.category ?? '—')} · ${esc(p.slug)}</span></div></td>
            <td class="num">${fmtUsd(p.mcap_usd)}</td>
            <td class="num">${fmtUsd(p.tvl_usd)}</td>
            <td class="num">${p.mcap_usd === null || p.tvl_usd <= 0 ? '—' : fmtMult(p.mcap_usd / p.tvl_usd)}</td>
            <td class="num ${p.change_7d === null ? '' : p.change_7d >= 0 ? 'pos' : 'neg'}">${fmtPct(p.change_7d)}</td>
            <td class="sub">${esc(fmtChains(p.chains))}</td>
            <td><span class="badge live">LIVE</span></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  return wrap;
}

function emptyEl() {
  const div = el('div', 'empty');
  div.innerHTML = `<h2>Nothing matches those filters.</h2><p>Try clearing the search or choosing a different category or chain.</p><button class="button primary" id="clear-filters" type="button">Clear filters</button>`;
  div.querySelector('#clear-filters').addEventListener('click', () => {
    state.q = ''; state.category = ''; state.chain = ''; state.watchlist = false; writeHash(); render(false);
  });
  return div;
}

function modelPanel() {
  const section = el('section', 'panel model');
  section.setAttribute('aria-label', 'How the model works');
  const M = MODEL;
  const comp = DATA.comparables.slice(0, 10);
  section.innerHTML = `
    <h2>How the model works</h2>
    <p>Every number below is computed from this snapshot at render time, and every row's detail view recomputes its own value from the same formula — the board and the page cannot disagree.</p>
    <div class="formula">implied value = TVL × category multiple × growth × maturity × youth × breadth<br>
    category multiple = shrunk median of (market cap / TVL) over live protocols in the same category, prior ${M.shrink_prior} at the global median ${fmtMult(DATA.global_multiple)}, clamped ${M.multiple_floor}–${M.multiple_cap}<br>
    growth = 1 + clamped 7d change × ${M.growth_weight_up} when rising, × ${M.growth_weight_down} when falling, change clamped to ${M.growth_floor}%…${M.growth_cap}%<br>
    maturity = ${M.maturity_floor} + ${M.maturity_range} × min(age, ${M.maturity_days}d) / ${M.maturity_days}d · youth = ${M.young_discount} when younger than ${M.young_age_days}d, else 1 · breadth = 1 + ${M.breadth_step} × min(chains − 1, ${M.breadth_max_chains})</div>
    <h3>Category comparables</h3>
    <table class="comp">
      <thead><tr><th>Category</th><th>Live protocols</th><th>Category median mcap / TVL</th><th>Multiple used</th></tr></thead>
      <tbody>
        ${comp.map((c) => `<tr><td>${esc(c.category)}</td><td>${c.live_n}</td><td>${c.category_median === null ? '—' : fmtMult(c.category_median)}</td><td>${fmtMult(c.multiple)}</td></tr>`).join('')}
      </tbody>
    </table>
    <p class="sub">A category with one live protocol cannot set its own price — the prior pulls it toward the global median. A category with no live protocol at all takes the global median ${fmtMult(DATA.global_multiple)}.</p>
    <p class="sub">Watchlist = the ${DATA.watchlist_size} protocols at or above the ${fmtUsd(DATA.floor_usd)} floor with no token recorded. Early = the ${DATA.early_size} rankable pre-token protocols below the floor. Excluded from the board: protocols with a live token (shown apart), exchanges, and versioned pools such as a V2 or v3 deployment of another protocol.</p>`;
  return section;
}

function footEl() {
  const p = el('p', 'foot');
  p.textContent = `Snapshot ${DATA.as_of} · ${DATA.source} · Model ${DATA.model_version}. Figures are the snapshot's own; gas prices are rough estimates for the named chain, never quotes. This is a radar, not advice: an airdrop is never guaranteed, and farming costs real money.`;
  return p;
}

/* ---------- the detail view ---------- */

function detailEl(row) {
  const dlg = el('dialog', 'detail');
  dlg.setAttribute('aria-label', `${row.name} detail`);
  const v = impliedOf(row);
  const match = v.implied === row.implied_value_usd;
  const steps = farmSteps(row);
  const why = row.watchlist
    ? `${row.name} is on the watchlist: ${fmtUsd(row.tvl_usd)} of TVL at or above the ${fmtUsd(DATA.floor_usd)} floor with no token recorded.`
    : `${row.name} is an early find: below the ${fmtUsd(DATA.floor_usd)} floor, so the watchlist misses it, and the board ranks it ${fmtUsd(row.implied_value_usd)} on its own figures.`;
  dlg.innerHTML = `
    <div class="detail-head">
      <div>
        <span class="status">Pre-token · rank #${row.rank} of ${DATA.board_size}</span>
        <h2>${esc(row.name)}</h2>
        <p class="sub">${esc(row.category ?? '—')} · ${esc(fmtChains(row.chains))} · listed ${esc(row.listed_at ?? 'unknown')} · ${fmtAge(row.age_days)} old</p>
      </div>
      <button class="close" type="button" data-close>Close ✕</button>
    </div>
    <div class="detail-section">
      <h3>Implied value: ${fmtUsd(row.implied_value_usd)} ${match ? '✓' : '— recomputed ' + fmtUsd(v.implied)}</h3>
      <p class="sub">Recomputed here, in this page, from the row's own figures — ${match ? 'it matches the board exactly.' : 'it does not match the board.'}</p>
      <div class="equation">
        <div><span>TVL</span><b>${money(row.tvl_usd)}</b></div>
        <div><span>× category multiple (${esc(row.category ?? 'Other')})</span><b>${fmtMult(row.category_multiple)}</b></div>
        <div><span>× growth (${fmtPct(v.growth)} in 7 days)</span><b>${v.growthMult.toFixed(3)}×</b></div>
        <div><span>× maturity (${fmtAge(row.age_days)} old)</span><b>${v.maturity.toFixed(3)}×</b></div>
        <div><span>× youth ${row.age_days !== null && row.age_days < MODEL.young_age_days ? `(younger than ${MODEL.young_age_days} days)` : ''}</span><b>${v.young.toFixed(2)}×</b></div>
        <div><span>× breadth (${row.chains.length} chain${row.chains.length === 1 ? '' : 's'})</span><b>${v.breadth.toFixed(2)}×</b></div>
        <div><span>= implied value</span><b>${money(v.implied)}</b></div>
      </div>
      <p class="why">${esc(why)}</p>
    </div>
    <div class="detail-section">
      <h3>Farm plan · 7 steps</h3>
      <ol class="steps">
        ${steps.map((s, i) => {
          const [action, rest] = s.split(' Cost: ');
          return `<li><b>Step ${i + 1}. ${esc(action)}</b><span class="cost">Cost: ${esc(rest)}</span></li>`;
        }).join('')}
      </ol>
      <p class="sub" style="margin-top:12px">Costs are rough gas estimates for ${esc(row.chains[0] ?? 'the chain')} and the capital tier the protocol's TVL sets. Never pay to claim an airdrop, and never follow a link from a message — claim only from the protocol's own page.</p>
    </div>`;
  dlg.querySelector('[data-close]').addEventListener('click', () => { state.selected = ''; writeHash(); render(false); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) { state.selected = ''; writeHash(); render(false); } });
  dlg.addEventListener('close', () => { if (state.selected) { state.selected = ''; writeHash(); render(false); } });
  return dlg;
}

/* ---------- render ---------- */

const root = document.getElementById('board');
function render(focus) {
  // Typing in the search box rebuilds the controls, which would drop focus after every
  // keystroke; remember it here and hand it back below.
  const searchHadFocus = document.activeElement && document.activeElement.id === 'q';
  const rows = sortedRows(filteredRows());
  root.innerHTML = '';
  const shell = el('div', 'shell');
  shell.appendChild(headerEl());
  shell.appendChild(ledeEl());
  shell.appendChild(topTenEl());
  shell.appendChild(controlsEl(state.tab === 'live' ? LIVE.length : rows.length));
  const panel = el('section', 'panel');
  panel.setAttribute('aria-label', state.tab === 'live' ? 'Live-token protocols' : 'Ranked board');
  if (state.tab === 'live') {
    panel.appendChild(liveTable());
  } else if (rows.length === 0) {
    panel.appendChild(emptyEl());
  } else {
    panel.appendChild(boardTable(rows));
  }
  shell.appendChild(panel);
  shell.appendChild(modelPanel());
  shell.appendChild(footEl());
  root.appendChild(shell);
  const selected = state.selected ? bySlug(state.selected) : null;
  if (selected) {
    const dlg = detailEl(selected);
    root.appendChild(dlg);
    dlg.showModal();
  }
  root.setAttribute('aria-busy', 'false');
  if (searchHadFocus) {
    const q = document.getElementById('q');
    if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }
  if (focus) root.focus();
}

window.addEventListener('hashchange', () => { state = readHash(); render(false); });
root.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (open) { e.preventDefault(); state.selected = open.dataset.open; writeHash(); render(false); }
});
render(false);
