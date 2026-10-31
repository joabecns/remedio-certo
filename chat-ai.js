// Cliente do assistente de IA. Só envia a pergunta e o nome do remédio cadastrado
// para o backend configurado em config.js. Não guarda nada no servidor do app.
(function () {
  'use strict';

  const cfg = window.REMEDIO_CERTO_CONFIG || {};
  const API_URL = typeof cfg.chatApiUrl === 'string' ? cfg.chatApiUrl.trim() : '';
  const TIMEOUT_MS = 25000;

  function enabled() {
    return API_URL.length > 0;
  }

  async function ask(args) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicine: {
            name: args.med.name,
            form: args.med.form,
            times: args.med.times || []
          },
          question: args.question,
          history: (args.history || []).slice(-8)
        }),
        signal: controller.signal
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data || typeof data.answer !== 'string' || !data.answer.trim()) {
        throw new Error('resposta inválida');
      }
      return data.answer.slice(0, 2000);
    } finally {
      clearTimeout(timer);
    }
  }

  window.RemedioAI = { enabled: enabled, ask: ask };
})();
