require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ ok: true, hasKey: !!ANTHROPIC_API_KEY });
});

app.post('/api/search', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada.' });
  }

  const { niche, sub, audience, platforms, languages, count } = req.body;
  if (!niche) return res.status(400).json({ error: 'El nicho es requerido.' });

  console.log(`[search] nicho: "${niche}" | plataformas: ${platforms.join(', ')}`);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: `Eres un experto en contenido viral. Busca en internet y devuelve SOLO JSON valido, sin texto extra:
{"platforms":{"youtube":[{"title":"","creator":"","language":"","views":"","format":"","hook":"","why_viral":"","reference":""}]},"viral_formats":[""]}
Solo las plataformas pedidas. Titulos en el idioma de cada video.`,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Dame los ${count} videos mas virales de "${niche}" en: ${platforms.join(', ')}. Idiomas: ${languages.join(', ')}. ${sub ? 'Temas: '+sub+'.' : ''} ${audience ? 'Audiencia: '+audience+'.' : ''} Solo JSON.`
        }]
      })
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error?.message || `API error ${r.status}`);
    }

    const data = await r.json();
    const raw = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    console.log(`[search] raw length: ${raw.length}`);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('La IA no devolvio JSON valido. Intenta de nuevo.');
    }

    res.json({ ok: true, data: parsed, webContextLength: raw.length });

  } catch (err) {
    console.error('[search] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Viral Finder en http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) console.warn('Falta ANTHROPIC_API_KEY');
});
