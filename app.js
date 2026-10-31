(function () {
  'use strict';

  const THEME_KEY = 'remedioCerto.theme';
  const DOSES_KEY = 'remedioCerto.doses';

  const FORM_ICONS = {
    comprimido: '💊',
    capsula: '💊',
    gota: '💧',
    injecao: '💉'
  };

  const STATUS_LABEL = {
    pending: { text: 'Pendente', icon: '⏳' },
    taken: { text: 'Tomado', icon: '✅' },
    late: { text: 'Atrasado', icon: '⚠️' }
  };

  // Dados de exemplo para visualizar a tela inicial (somem quando o cadastro existir).
  const DEMO_DOSES = [
    { id: 1, name: 'Losartana 50 mg', form: 'comprimido', time: '08:00', status: 'taken' },
    { id: 2, name: 'Metformina 850 mg', form: 'comprimido', time: '12:00', status: 'late' },
    { id: 3, name: 'Insulina NPH', form: 'injecao', time: '20:00', status: 'pending' }
  ];

  // ----- Armazenamento seguro (pode falhar em modo privado ou com dados bloqueados) -----
  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* ignora */ }
  }

  // ----- Tema -----
  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function currentTheme() {
    const saved = safeGet(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('btn-theme');
    const icon = document.getElementById('theme-icon');
    const isDark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(isDark));
    btn.setAttribute('aria-label', isDark ? 'Desativar modo escuro' : 'Ativar modo escuro');
    icon.textContent = isDark ? '☀️' : '🌙';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#0F172A' : '#0F766E');
  }

  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    safeSet(THEME_KEY, next);
    applyTheme(next);
  }

  // ----- Doses -----
  function loadDoses() {
    try {
      const raw = safeGet(DOSES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* usa exemplo */ }
    return DEMO_DOSES.map(d => ({ ...d }));
  }

  function sortByTime(doses) {
    return doses.slice().sort((a, b) => a.time.localeCompare(b.time));
  }

  function renderSummary(doses) {
    const taken = doses.filter(d => d.status === 'taken').length;
    const total = doses.length;
    const percent = total ? Math.round((taken / total) * 100) : 0;

    document.getElementById('progress-text').textContent =
      total ? `${taken} de ${total} doses tomadas` : 'Sem doses hoje';

    const bar = document.getElementById('progress-bar');
    bar.style.width = percent + '%';
    bar.parentElement.setAttribute('aria-valuenow', String(percent));
  }

  function renderDoses(doses) {
    const list = document.getElementById('dose-list');
    const empty = document.getElementById('empty');
    list.innerHTML = '';

    if (!doses.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    sortByTime(doses).forEach(dose => {
      const item = document.createElement('li');
      item.className = 'dose' +
        (dose.status === 'late' ? ' is-late' : '') +
        (dose.status === 'taken' ? ' is-taken' : '');

      const icon = document.createElement('div');
      icon.className = 'dose-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = FORM_ICONS[dose.form] || '💊';

      const info = document.createElement('div');

      const name = document.createElement('p');
      name.className = 'dose-name';
      name.textContent = dose.name;

      const meta = document.createElement('p');
      meta.className = 'dose-meta';
      meta.textContent = `Horário: ${dose.time}`;

      const s = STATUS_LABEL[dose.status] || STATUS_LABEL.pending;
      const badge = document.createElement('span');
      badge.className = 'status ' + (dose.status || 'pending');
      badge.textContent = `${s.icon} ${s.text}`;

      info.append(name, meta, badge);
      item.append(icon, info);
      list.appendChild(item);
    });
  }

  function renderDate() {
    const now = new Date();
    const text = now.toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    document.getElementById('today-date').textContent = text;
  }

  // ----- Service worker (funciona offline depois da primeira visita) -----
  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* ignora em testes */ });
    }
  }

  // ----- Inicialização -----
  function init() {
    applyTheme(currentTheme());
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);

    // Se o usuário não escolheu tema, acompanha a preferência do sistema.
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (!safeGet(THEME_KEY)) applyTheme(currentTheme());
      });
    }

    renderDate();
    const doses = loadDoses();
    renderSummary(doses);
    renderDoses(doses);
    registerServiceWorker();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
