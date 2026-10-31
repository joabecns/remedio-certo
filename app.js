(function () {
  'use strict';

  const KEYS = {
    theme: 'remedioCerto.theme',
    medicines: 'remedioCerto.medicines',
    status: 'remedioCerto.status',
    alerts: 'remedioCerto.alerts'
  };
  const SNOOZE_MIN = 10;
  const SECOND_REMINDER_MIN = 15;
  const CHECK_EVERY_MS = 15000;
  const MAX_TIMES = 6;
  const LATE_AFTER_MIN = 60;
  const MIN_QUERY = 2;

  const FORM_ICONS = { comprimido: '💊', capsula: '💊', gota: '💧', injecao: '💉' };
  const FORM_NAMES = { comprimido: 'Comprimido', capsula: 'Cápsula', gota: 'Gota', injecao: 'Injeção' };
  const STATUS_LABEL = {
    pending: { text: 'Pendente', icon: '⏳' },
    taken: { text: 'Tomado', icon: '✅' },
    late: { text: 'Atrasado', icon: '⚠️' }
  };

  // Exemplo exibido só enquanto não há remédios cadastrados.
  const DEMO_DOSES = [
    { key: 'demo-1', name: 'Losartana potássica 50 mg', form: 'comprimido', time: '08:00', status: 'taken', photo: null },
    { key: 'demo-2', name: 'Metformina 850 mg', form: 'comprimido', time: '12:00', status: 'late', photo: null },
    { key: 'demo-3', name: 'Insulina NPH', form: 'injecao', time: '20:00', status: 'pending', photo: null }
  ];

  const $ = id => document.getElementById(id);

  // ===== Armazenamento seguro (pode falhar em modo privado ou com dados bloqueados) =====
  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function readJSON(key, fallback) {
    try {
      const raw = safeGet(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return value == null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  // ===== Datas e textos =====
  const pad = n => String(n).padStart(2, '0');

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function minutesOf(hhmm) {
    const parts = hhmm.split(':').map(Number);
    return parts[0] * 60 + parts[1];
  }

  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  // Remove acentos e maiúsculas para a busca.
  function normalize(text) {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  // ===== Tema =====
  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function currentTheme() {
    const saved = safeGet(KEYS.theme);
    if (saved === 'dark' || saved === 'light') return saved;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = $('btn-theme');
    const icon = $('theme-icon');
    const isDark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(isDark));
    btn.setAttribute('aria-label', isDark ? 'Desativar modo escuro' : 'Ativar modo escuro');
    icon.textContent = isDark ? '☀️' : '🌙';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#0F172A' : '#0F766E');
  }

  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    safeSet(KEYS.theme, next);
    applyTheme(next);
  }

  // ===== Dados =====
  function loadMedicines() {
    const value = readJSON(KEYS.medicines, []);
    return Array.isArray(value) ? value : [];
  }

  function saveMedicines(list) {
    return safeSet(KEYS.medicines, JSON.stringify(list));
  }

  function loadStatus() {
    const value = readJSON(KEYS.status, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function saveStatus(map) {
    return safeSet(KEYS.status, JSON.stringify(map));
  }

  // Transforma os remédios cadastrados nas doses de hoje.
  function buildDoses(meds) {
    const status = loadStatus();
    const day = todayKey();
    const now = nowMinutes();
    const doses = [];

    meds.forEach(med => {
      (med.times || []).forEach(time => {
        const key = `${day}|${med.id}|${time}`;
        let st = status[key] || 'pending';
        if (st === 'pending' && now > minutesOf(time) + LATE_AFTER_MIN) st = 'late';
        doses.push({ key, name: med.name, form: med.form, photo: med.photo, time, status: st });
      });
    });

    return doses;
  }

  // ===== Início =====
  function renderDate() {
    const text = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('today-date').textContent = text;
  }

  function renderSummary(doses) {
    const taken = doses.filter(d => d.status === 'taken').length;
    const total = doses.length;
    const percent = total ? Math.round((taken / total) * 100) : 0;

    $('progress-text').textContent = total ? `${taken} de ${total} doses tomadas` : 'Sem doses hoje';
    const bar = $('progress-bar');
    bar.style.width = percent + '%';
    bar.parentElement.setAttribute('aria-valuenow', String(percent));
  }

  function renderDoses(doses, isDemo) {
    const list = $('dose-list');
    list.innerHTML = '';

    doses
      .slice()
      .sort((a, b) => a.time.localeCompare(b.time))
      .forEach(dose => {
        const item = document.createElement('li');
        item.className = 'dose' +
          (dose.status === 'late' ? ' is-late' : '') +
          (dose.status === 'taken' ? ' is-taken' : '');

        const icon = document.createElement('div');
        icon.className = 'dose-icon';
        if (dose.photo) {
          const img = document.createElement('img');
          img.src = dose.photo;
          img.alt = `Foto da caixa de ${dose.name}`;
          icon.appendChild(img);
        } else {
          icon.setAttribute('aria-hidden', 'true');
          icon.textContent = FORM_ICONS[dose.form] || '💊';
        }

        const info = document.createElement('div');

        const name = document.createElement('p');
        name.className = 'dose-name';
        name.textContent = dose.name;

        const meta = document.createElement('p');
        meta.className = 'dose-meta';
        const formName = FORM_NAMES[dose.form];
        meta.textContent = `Horário: ${dose.time}` + (formName ? ` · ${formName}` : '');

        const s = STATUS_LABEL[dose.status] || STATUS_LABEL.pending;
        const badge = document.createElement('span');
        badge.className = 'status ' + (dose.status || 'pending');
        badge.textContent = `${s.icon} ${s.text}`;

        info.append(name, meta, badge);

        if (!isDemo && dose.status !== 'taken') {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'action-btn small-btn dose-take';
          btn.textContent = 'Marcar como tomado';
          btn.setAttribute('aria-label', `Marcar ${dose.name} das ${dose.time} como tomado`);
          btn.addEventListener('click', () => {
            const map = loadStatus();
            map[dose.key] = 'taken';
            saveStatus(map);
            renderHome();
            showToast('Dose registrada');
          });
          info.appendChild(btn);
        }

        item.append(icon, info);
        list.appendChild(item);
      });
  }

  function renderHome() {
    const meds = loadMedicines();
    const isDemo = meds.length === 0;
    $('demo-note').hidden = !isDemo;
    $('empty').hidden = true;

    const doses = isDemo ? DEMO_DOSES.map(d => ({ ...d })) : buildDoses(meds);
    renderSummary(doses);
    renderDoses(doses, isDemo);
  }

  // ===== Cadastro: nome com autocomplete =====
  const nameInput = $('med-name');
  const suggestions = $('med-suggestions');
  let matches = [];
  let activeIdx = -1;

  function closeSuggestions() {
    suggestions.hidden = true;
    suggestions.innerHTML = '';
    nameInput.setAttribute('aria-expanded', 'false');
    nameInput.removeAttribute('aria-activedescendant');
    matches = [];
    activeIdx = -1;
  }

  function updateSuggestions() {
    const q = normalize(nameInput.value);
    if (q.length < MIN_QUERY) {
      closeSuggestions();
      return;
    }
    const base = Array.isArray(window.MEDICAMENTOS) ? window.MEDICAMENTOS : [];
    matches = base
      .filter(m => normalize(m.nome).includes(q))
      .sort((a, b) => {
        const sa = normalize(a.nome).startsWith(q) ? 0 : 1;
        const sb = normalize(b.nome).startsWith(q) ? 0 : 1;
        return sa - sb || a.nome.localeCompare(b.nome, 'pt-BR');
      })
      .slice(0, 8);
    activeIdx = -1;
    renderSuggestions();
  }

  function renderSuggestions() {
    suggestions.innerHTML = '';
    if (!matches.length) {
      closeSuggestions();
      return;
    }
    matches.forEach((m, i) => {
      const li = document.createElement('li');
      li.id = `sug-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === activeIdx));
      li.textContent = m.nome;
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        chooseSuggestion(i);
      });
      suggestions.appendChild(li);
    });
    suggestions.hidden = false;
    nameInput.setAttribute('aria-expanded', 'true');
  }

  function markActive() {
    Array.from(suggestions.children).forEach((li, i) => {
      li.setAttribute('aria-selected', String(i === activeIdx));
    });
    if (activeIdx >= 0) {
      nameInput.setAttribute('aria-activedescendant', `sug-${activeIdx}`);
      suggestions.children[activeIdx].scrollIntoView({ block: 'nearest' });
    } else {
      nameInput.removeAttribute('aria-activedescendant');
    }
  }

  function selectForm(form) {
    const radio = document.querySelector(`input[name="forma"][value="${form}"]`);
    if (radio) radio.checked = true;
  }

  function chooseSuggestion(i) {
    const m = matches[i];
    if (!m) return;
    nameInput.value = m.nome;
    selectForm(m.forma);
    closeSuggestions();
    clearError('err-name');
  }

  nameInput.addEventListener('input', () => {
    clearError('err-name');
    updateSuggestions();
  });

  nameInput.addEventListener('keydown', e => {
    if (suggestions.hidden || !matches.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = (activeIdx + 1) % matches.length;
      markActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = activeIdx <= 0 ? matches.length - 1 : activeIdx - 1;
      markActive();
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      chooseSuggestion(activeIdx);
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  });

  nameInput.addEventListener('blur', () => setTimeout(closeSuggestions, 150));

  // ===== Cadastro: horários =====
  let times = ['08:00'];

  function renderTimes() {
    const box = $('times');
    box.innerHTML = '';

    times.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'time-row';

      const label = document.createElement('label');
      label.className = 'time-label';
      label.htmlFor = `time-${i}`;
      label.textContent = `Horário ${i + 1}`;

      const input = document.createElement('input');
      input.type = 'time';
      input.id = `time-${i}`;
      input.value = t;
      input.required = true;
      input.addEventListener('input', () => {
        times[i] = input.value;
        clearError('err-times');
      });

      row.append(label, input);

      if (times.length > 1) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'link-btn';
        remove.textContent = 'Remover';
        remove.setAttribute('aria-label', `Remover horário ${i + 1}`);
        remove.addEventListener('click', () => {
          times.splice(i, 1);
          renderTimes();
        });
        row.appendChild(remove);
      }

      box.appendChild(row);
    });

    $('add-time').disabled = times.length >= MAX_TIMES;
  }

  $('add-time').addEventListener('click', () => {
    if (times.length >= MAX_TIMES) return;
    times.push('12:00');
    renderTimes();
    const last = $(`time-${times.length - 1}`);
    if (last) last.focus();
  });

  // ===== Cadastro: foto opcional (reduzida antes de salvar) =====
  let photoData = null;

  function shrinkImage(file, maxSide) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('imagem inválida'));
      };
      img.src = url;
    });
  }

  function setPhotoPreview(src) {
    const box = $('photo-preview');
    box.innerHTML = '';
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Prévia da foto do remédio';
      box.appendChild(img);
      box.setAttribute('aria-hidden', 'false');
    } else {
      box.textContent = '📷';
      box.setAttribute('aria-hidden', 'true');
    }
    $('remove-photo').hidden = !src;
  }

  $('med-photo').addEventListener('change', async e => {
    clearError('err-photo');
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      photoData = await shrinkImage(file, 320);
      setPhotoPreview(photoData);
    } catch (err) {
      photoData = null;
      e.target.value = '';
      setPhotoPreview(null);
      showError('err-photo', 'Não foi possível carregar esta foto. Tente outra imagem.');
    }
  });

  $('remove-photo').addEventListener('click', () => {
    photoData = null;
    $('med-photo').value = '';
    setPhotoPreview(null);
  });

  // ===== Mensagens de erro e aviso =====
  function showError(id, message) {
    const el = $(id);
    el.textContent = message;
    el.hidden = false;
  }

  function clearError(id) {
    const el = $(id);
    el.textContent = '';
    el.hidden = true;
  }

  function clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(el => {
      el.textContent = '';
      el.hidden = true;
    });
  }

  let toastTimer = null;
  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2500);
  }

  // ===== Cadastro: salvar e cancelar =====
  function resetForm() {
    nameInput.value = '';
    closeSuggestions();
    times = ['08:00'];
    renderTimes();
    selectForm('comprimido');
    photoData = null;
    $('med-photo').value = '';
    setPhotoPreview(null);
    clearAllErrors();
  }

  $('med-form').addEventListener('submit', e => {
    e.preventDefault();
    clearAllErrors();

    const name = nameInput.value.trim().replace(/\s+/g, ' ');
    const formRadio = document.querySelector('input[name="forma"]:checked');
    const form = formRadio ? formRadio.value : 'comprimido';

    let firstInvalid = null;

    if (name.length < MIN_QUERY) {
      showError('err-name', 'Digite o nome do remédio.');
      firstInvalid = nameInput;
    }

    const emptyIndex = times.findIndex(t => !t);
    if (emptyIndex !== -1) {
      showError('err-times', 'Preencha todos os horários ou remova os vazios.');
      if (!firstInvalid) firstInvalid = $(`time-${emptyIndex}`);
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const med = {
      id: Date.now(),
      name,
      form,
      times: Array.from(new Set(times)).sort(),
      photo: photoData
    };

    const list = loadMedicines();
    list.push(med);

    if (!saveMedicines(list)) {
      showError('err-form', 'Não foi possível salvar neste navegador. Verifique se o armazenamento está liberado e tente de novo.');
      return;
    }

    // Pede permissão de notificação no clique de salvar (o navegador exige um gesto do usuário).
    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (err) { /* ignora */ }
    }

    resetForm();
    showView('home');
    showToast(`${name} salvo`);
    checkAlerts();
  });

  $('cancel-add').addEventListener('click', () => {
    resetForm();
    showView('home');
  });

  // ===== Navegação =====
  function showView(name) {
    $('view-home').hidden = name !== 'home';
    $('view-add').hidden = name !== 'add';
    $('view-bula').hidden = name !== 'bula';
    $('view-chat').hidden = name !== 'chat';

    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      const active = btn.dataset.view === name;
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });

    if (name === 'add') {
      $('add-title').focus();
    } else if (name === 'bula') {
      renderBula();
      $('bula-title').focus();
    } else if (name === 'chat') {
      chatStart();
      $('chat-title').focus();
    } else {
      renderHome();
    }
    window.scrollTo(0, 0);
  }

  // ===== Bulário: link para o site oficial =====
  // CONFIRMAR antes de publicar: endereço da página de consulta do Bulário Eletrônico da Anvisa.
  const BULARIO_URL = 'https://consultas.anvisa.gov.br/#/bulario/';

  function renderBula() {
    const list = $('bula-list');
    list.innerHTML = '';

    const meds = loadMedicines();
    const names = meds.length
      ? Array.from(new Set(meds.map(m => m.name)))
      : DEMO_DOSES.map(d => d.name);

    names.forEach(name => {
      const item = document.createElement('li');
      item.className = 'bula-item';

      const label = document.createElement('p');
      label.className = 'bula-name';
      label.textContent = name;

      const link = document.createElement('a');
      link.className = 'action-btn small-btn bula-link';
      link.href = BULARIO_URL;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `Abrir bula de ${name} no site da Anvisa`;

      item.append(label, link);
      list.appendChild(item);
    });
  }

  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  $('go-add-empty').addEventListener('click', () => showView('add'));

  // ===== Service worker (funciona offline depois da primeira visita) =====
  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* ignora em testes */ });
    }
  }

  // ===== Alerta de dose =====
  // Regras: 1º aviso no horário; 2º aviso após 15 min sem confirmação;
  // "Adiar 10 min" reagenda o aviso; após 1 hora sem confirmação a dose fica
  // "Atrasada" e o cuidador seria avisado (nesta prévia, apenas uma mensagem).
  let currentAlertKey = null;

  function loadAlerts() {
    const value = readJSON(KEYS.alerts, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function saveAlerts(map) {
    return safeSet(KEYS.alerts, JSON.stringify(map));
  }

  function isDemoKey(key) {
    return String(key).indexOf('demo') === 0;
  }

  function playBeep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) { /* som é opcional */ }
  }

  function notifyBackground(dose, label) {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
    try {
      new Notification(`${label}: ${dose.name}`, {
        body: `Horário ${dose.time}. Confirme se já tomou.`,
        icon: 'icons/icon.svg',
        tag: dose.key
      });
    } catch (e) { /* ignora */ }
  }

  function showAlert(dose, label) {
    currentAlertKey = dose.key;
    $('alert-stage').textContent = label;
    $('alert-title').textContent = dose.name;
    $('alert-desc').textContent = `Horário: ${dose.time}. Confirme se já tomou.`;

    const icon = $('alert-icon');
    icon.innerHTML = '';
    if (dose.photo) {
      const img = document.createElement('img');
      img.src = dose.photo;
      img.alt = '';
      icon.appendChild(img);
    } else {
      icon.textContent = FORM_ICONS[dose.form] || '💊';
    }

    $('alert').hidden = false;
    $('alert-take').focus();
    if (navigator.vibrate) {
      try { navigator.vibrate([300, 200, 300]); } catch (e) { /* ignora */ }
    }
    playBeep();
    notifyBackground(dose, label);
  }

  function hideAlert() {
    $('alert').hidden = true;
    currentAlertKey = null;
  }

  function snoozeAlert() {
    if (currentAlertKey && !isDemoKey(currentAlertKey)) {
      const alerts = loadAlerts();
      const rec = alerts[currentAlertKey] || { count: 1, lastShown: Date.now() };
      rec.snoozeUntil = Date.now() + SNOOZE_MIN * 60000;
      alerts[currentAlertKey] = rec;
      saveAlerts(alerts);
    }
    hideAlert();
    showToast(`Lembrete em ${SNOOZE_MIN} minutos`);
  }

  function takeFromAlert() {
    if (currentAlertKey && !isDemoKey(currentAlertKey)) {
      const map = loadStatus();
      map[currentAlertKey] = 'taken';
      saveStatus(map);
    }
    hideAlert();
    renderHome();
    showToast('Dose registrada');
  }

  function checkAlerts() {
    const meds = loadMedicines();
    if (!meds.length) return;
    if (!$('alert').hidden) return; // já existe um alerta aberto

    const today = todayKey();
    const alerts = loadAlerts();
    const now = Date.now();
    let changed = false;

    // Remove registros de dias anteriores.
    Object.keys(alerts).forEach(key => {
      if (key.indexOf(today) !== 0) { delete alerts[key]; changed = true; }
    });

    const doses = buildDoses(meds);
    let toShow = null;

    doses.forEach(dose => {
      if (dose.status === 'late') {
        const rec = alerts[dose.key] || { count: 0 };
        if (!rec.caregiverNotified) {
          rec.caregiverNotified = true;
          alerts[dose.key] = rec;
          changed = true;
          showToast(`${dose.name} não foi confirmado. O cuidador seria avisado.`);
        }
        return;
      }

      if (dose.status !== 'pending' || nowMinutes() < minutesOf(dose.time)) return;
      if (toShow) return; // mostra um alerta por vez

      const rec = alerts[dose.key] || { count: 0, lastShown: 0, snoozeUntil: 0 };
      if (rec.snoozeUntil && now < rec.snoozeUntil) return;

      let due = false;
      if (rec.count === 0) due = true;                                       // 1º aviso
      else if (rec.snoozeUntil) due = true;                                  // voltou do adiamento
      else if (rec.count === 1 && now - rec.lastShown >= SECOND_REMINDER_MIN * 60000) due = true; // 2º aviso

      if (!due) return;

      const label = rec.count === 0 ? 'Hora do remédio' : (rec.count === 1 && !rec.snoozeUntil ? 'Segundo aviso' : 'Lembrete');
      rec.count += 1;
      rec.lastShown = now;
      rec.snoozeUntil = 0;
      alerts[dose.key] = rec;
      changed = true;
      toShow = { dose, label };
    });

    if (changed) saveAlerts(alerts);
    if (toShow) showAlert(toShow.dose, toShow.label);
  }

  $('alert-take').addEventListener('click', takeFromAlert);
  $('alert-snooze').addEventListener('click', snoozeAlert);

  // Esc adia; Tab alterna entre os dois botões (o foco não sai do alerta).
  $('alert').addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      snoozeAlert();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const take = $('alert-take');
      const snooze = $('alert-snooze');
      (document.activeElement === take ? snooze : take).focus();
    }
  });

  $('demo-alert').addEventListener('click', () => {
    showAlert({ key: 'demo-alert', name: 'Losartana potássica 50 mg', form: 'comprimido', time: '08:00', photo: null }, 'Exemplo');
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkAlerts();
  });

  // ===== Chatbot: respostas fixas, só sobre os remédios cadastrados =====
  // Não usa IA nem envia dados para fora do aparelho. Cada resposta é um texto fixo
  // preenchido apenas com o nome, a forma e os horários cadastrados.

  const EMERGENCY_WORDS = ['socorro', 'emergencia', 'desmai', 'falta de ar', 'dor no peito',
    'sangramento', 'convuls', 'overdose', 'muito mal', 'nao consigo respirar'];
  const EMERGENCY_TEXT = 'Se for uma emergência, ligue 192 (SAMU) agora ou procure o pronto-socorro mais próximo.';
  const OUT_OF_SCOPE_TEXT = 'Só posso responder sobre os remédios que você cadastrou. Para outras dúvidas, procure seu médico ou farmacêutico.';

  const INTENT_WORDS = [
    ['missed', ['esqueci', 'esquec', 'perdi', 'atrasad', 'dobrar', 'em dobro', 'duas vezes']],
    ['side', ['efeito', 'colateral', 'reacao', 'passar mal', 'enjoo', 'tontura', 'mal estar']],
    ['bula', ['bula', 'bulario']],
    ['schedule', ['horario', 'que hora', 'quando']],
    ['purpose', ['para que', 'serve', 'indica', 'usar']],
    ['form', ['forma', 'tipo', 'comprimido', 'capsula', 'gota', 'injecao']],
    ['howto', ['como tomar', 'como usar', 'tomar', 'dose', 'quantos', 'quanto']],
    ['greet', ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite']]
  ];

  const INTENT_LABELS = {
    purpose: 'Para que serve?',
    howto: 'Como tomar?',
    schedule: 'Horários',
    missed: 'Esqueci uma dose',
    side: 'Efeitos colaterais',
    bula: 'Ver bula',
    form: 'Forma'
  };

  let chatMedId = null;

  function medKeyword(name) {
    const first = normalize(name).split(/\s+/)[0] || '';
    return first.length >= 4 ? first : '';
  }

  function detectIntent(q) {
    // Saudação só vale no início da frase, para não confundir palavras como "foi" ou "dois".
    if (/^(oi|ola|bom dia|boa tarde|boa noite)\b/.test(q)) return 'greet';
    for (const [intent, words] of INTENT_WORDS) {
      if (intent === 'greet') continue;
      if (words.some(w => q.indexOf(w) !== -1)) return intent;
    }
    return null;
  }

  function chatAppend(role, text) {
    const log = $('chat-log');
    const msg = document.createElement('div');
    msg.className = 'chat-msg ' + role;
    msg.textContent = text;
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
    return msg;
  }

  function chatBotSay(text, linkToBula) {
    const msg = chatAppend('bot', text);
    if (linkToBula) {
      const link = document.createElement('a');
      link.className = 'action-btn small-btn bula-link';
      link.href = BULARIO_URL;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Abrir bula oficial (site da Anvisa)';
      msg.appendChild(link);
    }
  }

  function chatSetChips(items) {
    const box = $('chat-chips');
    box.innerHTML = '';
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = item.label;
      btn.addEventListener('click', item.action);
      box.appendChild(btn);
    });
  }

  function chatMedChips(med) {
    const items = ['purpose', 'howto', 'schedule', 'missed', 'side', 'bula'].map(intent => ({
      label: INTENT_LABELS[intent],
      action: () => chatAnswer(intent, med)
    }));
    if (loadMedicines().length > 1) {
      items.push({ label: 'Trocar remédio', action: chatAskWhich });
    }
    chatSetChips(items);
  }

  function chatAskWhich() {
    const meds = loadMedicines();
    chatBotSay('Sobre qual remédio você quer saber?');
    chatSetChips(meds.map(m => ({
      label: m.name,
      action: () => {
        chatMedId = m.id;
        chatAppend('user', m.name);
        chatBotSay(`Certo, sobre ${m.name}. O que você quer saber?`);
        chatMedChips(m);
      }
    })));
  }

  function chatAnswer(intent, med) {
    const times = (med.times || []).join(', ') || 'não cadastrados';
    const formName = (FORM_NAMES[med.form] || 'não informada').toLowerCase();
    const name = med.name;

    const replies = {
      purpose: `Eu não tenho a indicação de ${name} cadastrada. Para saber para que ele serve, veja a bula oficial ou pergunte ao seu médico ou farmacêutico.`,
      howto: `Você cadastrou ${name} (${formName}) nestes horários: ${times}. Tome conforme a receita do seu médico e a bula. Não mude a dose sem orientação.`,
      schedule: `Horários cadastrados para ${name}: ${times}.`,
      form: `${name} está cadastrado como ${formName}.`,
      missed: 'Se esquecer uma dose, não tome duas doses juntas sem orientação. Confirme com seu médico ou farmacêutico o que fazer.',
      side: `Não tenho a lista de efeitos colaterais de ${name}. Veja a seção de reações adversas na bula oficial. Se sentir mal, procure seu médico ou farmacêutico. ${EMERGENCY_TEXT}`,
      bula: 'Você pode consultar a bula oficial no site da Anvisa. Escolha "Bulário Eletrônico" e digite o nome do remédio.',
      greet: `Olá! Em que posso ajudar sobre ${name}?`
    };

    chatBotSay(replies[intent] || OUT_OF_SCOPE_TEXT, intent === 'bula' || intent === 'purpose' || intent === 'side');
    chatMedChips(med);
  }

  function chatHandle(text) {
    const q = normalize(text);
    chatAppend('user', text);

    if (EMERGENCY_WORDS.some(w => q.indexOf(w) !== -1)) {
      chatBotSay(EMERGENCY_TEXT);
      return;
    }

    const meds = loadMedicines();
    if (!meds.length) {
      chatBotSay('Você ainda não cadastrou nenhum remédio. Cadastre um na aba Adicionar para eu poder ajudar.');
      chatSetChips([{ label: 'Ir para Adicionar', action: () => showView('add') }]);
      return;
    }

    if (q.indexOf('trocar') !== -1 || q.indexOf('outro remedio') !== -1) {
      chatAskWhich();
      return;
    }

    // Se o nome de um remédio cadastrado aparecer na pergunta, ele passa a ser o assunto.
    const mentioned = meds.find(m => {
      const kw = medKeyword(m.name);
      return kw && q.indexOf(kw) !== -1;
    });
    if (mentioned) chatMedId = mentioned.id;

    let med = meds.find(m => m.id === chatMedId) || null;
    if (!med && meds.length === 1) {
      med = meds[0];
      chatMedId = med.id;
    }
    if (!med) {
      chatAskWhich();
      return;
    }

    const intent = detectIntent(q);
    if (!intent) {
      chatBotSay(OUT_OF_SCOPE_TEXT);
      chatMedChips(med);
      return;
    }
    chatAnswer(intent, med);
  }

  function chatStart() {
    $('chat-log').innerHTML = '';
    const meds = loadMedicines();
    if (!meds.length) {
      chatBotSay('Olá! Ainda não há remédios cadastrados. Cadastre um para eu poder ajudar.');
      chatSetChips([{ label: 'Ir para Adicionar', action: () => showView('add') }]);
      return;
    }
    if (meds.length === 1) {
      chatMedId = meds[0].id;
      chatBotSay(`Olá! Posso responder sobre ${meds[0].name}. Escolha uma opção ou escreva sua pergunta.`);
      chatMedChips(meds[0]);
      return;
    }
    chatBotSay('Olá! Escolha um remédio ou escreva sua pergunta com o nome dele.');
    chatAskWhich();
  }

  $('chat-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    chatHandle(text.slice(0, 200));
  });

  // ===== Inicialização =====
  function init() {
    applyTheme(currentTheme());
    $('btn-theme').addEventListener('click', toggleTheme);

    // Sem escolha manual, acompanha a preferência do sistema.
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (!safeGet(KEYS.theme)) applyTheme(currentTheme());
      });
    }

    renderDate();
    renderTimes();
    selectForm('comprimido');
    renderHome();
    registerServiceWorker();
    checkAlerts();
    setInterval(checkAlerts, CHECK_EVERY_MS);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
