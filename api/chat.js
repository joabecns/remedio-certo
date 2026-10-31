// Backend do assistente de IA do Remédio Certo (função serverless, ex.: Vercel).
//
// Usa a API da Groq (compatível com o formato da OpenAI).
//
// Variáveis de ambiente (configurar no painel da hospedagem, NUNCA no código):
//   GROQ_API_KEY   -> chave da Groq (obrigatória)
//   GROQ_MODEL     -> modelo (opcional; padrão: llama-3.3-70b-versatile)
//   ALLOWED_ORIGIN -> endereço do app que pode chamar esta API
//                     (ex.: https://joabecns.github.io)
//
// Este arquivo não guarda conversas. Cada pedido é processado e descartado.

const SYSTEM_PROMPT = `Você é o assistente do app Remédio Certo, usado por pessoas idosas e cuidadores no Brasil.

Regras obrigatórias:
1. Responda SOMENTE sobre o remédio informado pelo app. Se a pergunta for de outro assunto, diga que só responde sobre o remédio cadastrado.
2. Não altere, sugira, calcule ou compare doses, horários ou tratamentos. Oriente seguir a receita do médico e a bula.
3. Não faça diagnóstico e não diga se um sintoma é grave ou leve. Se a pessoa descrever sintomas novos, piora, reação alérgica, sangramento, desmaio, falta de ar ou dor no peito, oriente a procurar atendimento agora e a ligar 192 (SAMU).
4. Se não tiver certeza de uma informação, diga que não sabe e oriente a bula oficial ou o farmacêutico. Não invente.
5. Termine sempre lembrando de conferir a bula oficial (Bulário Eletrônico da Anvisa) ou perguntar ao médico ou farmacêutico.
6. Não peça dados pessoais, nomes, documentos ou endereços.
7. Escreva em português do Brasil, com frases curtas e palavras simples, para leitura fácil. Use no máximo 6 frases.`;

const FORM_NAMES = {
  comprimido: 'comprimido',
  capsula: 'cápsula',
  gota: 'gotas',
  injecao: 'injeção'
};

const MAX_QUESTION = 300;
const MAX_HISTORY = 8;
const MAX_NAME = 120;

function cleanText(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function buildContext(medicine) {
  const name = cleanText(medicine.name, MAX_NAME);
  const form = FORM_NAMES[medicine.form] || 'não informada';
  const times = Array.isArray(medicine.times)
    ? medicine.times.map(t => cleanText(t, 5)).filter(Boolean).join(', ')
    : '';
  return `Remédio cadastrado pelo usuário: ${name}. Forma: ${form}. Horários cadastrados: ${times || 'não informados'}.`;
}

module.exports = async function handler(req, res) {
  const origin = process.env.ALLOWED_ORIGIN || 'https://joabecns.github.io';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Assistente não configurado.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const medicine = body.medicine || {};
  const question = cleanText(body.question, MAX_QUESTION);
  if (!question) return res.status(400).json({ error: 'Pergunta vazia.' });
  if (!medicine.name) return res.status(400).json({ error: 'Remédio não informado.' });

  // Histórico curto e sanitizado: só papéis válidos e texto limitado.
  const history = Array.isArray(body.history)
    ? body.history
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-MAX_HISTORY)
        .map(m => ({ role: m.role, content: cleanText(m.content, 1000) }))
    : [];

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: `${buildContext(medicine)}\n\nPergunta: ${question}` }
  ];

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        max_tokens: 400,
        temperature: 0.2,
        messages
      })
    });

    if (!upstream.ok) {
      // Registra só o código e o começo da mensagem de erro da Groq (sem dados do usuário), para diagnóstico nos logs da Vercel.
      const detail = await upstream.text().catch(() => '');
      console.error('Groq respondeu com erro', upstream.status, detail.slice(0, 300));
      return res.status(502).json({ error: 'Falha ao consultar o assistente.' });
    }

    const data = await upstream.json();
    const answer = String(
      (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || ''
    ).trim();

    if (!answer) return res.status(502).json({ error: 'Resposta vazia.' });
    return res.status(200).json({ answer });
  } catch (err) {
    return res.status(502).json({ error: 'Falha de conexão com o assistente.' });
  }
};
