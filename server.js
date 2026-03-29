require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, hasKey: !!ANTHROPIC_API_KEY });
});

// Proxy endpoint — streams or waits for full Anthropic response
app.post('/api/search', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada. Agrégala en las variables de entorno.' });
  }

  const { niche, sub, audience, platforms, languages, count } = req.body;

  if (!niche) return res.status(400).json({ error: 'El nicho es requerido.' });

  try {
    // ── PASO 1: Web search ──
    console.log(`[search] Iniciando búsqueda para nicho: "${niche}"`);

    const searchRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Busca videos virales del nicho "${niche}" en ${platforms.join(', ')}. Idiomas: ${languages.join(', ')}. ${sub ? 'Sub-nichos: '+sub+'.' : ''} ${audience ? 'Audiencia: '+audience+'.' : ''} Encuentra: títulos de videos virales, creadores dominantes, formatos que funcionan, vistas aproximadas. Año: 2024-2025.`
        }]
      })
    });

    if (!searchRes.ok) {
      const errData = await searchRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API error ${searchRes.status}`);
    }

    const searchData = await searchRes.json();
    const webCtx = searchData.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    console.log(`[search] Búsqueda web completada. Contexto: ${webCtx.length} chars`);

    // ── PASO 2: Estructurar resultados ──
    const analyzeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        system: 'Eres un experto en análisis de contenido viral. Responde SOLO con JSON válido, sin texto adicional, sin bloques de código markdown.',
        messages: [{
          role: 'user',
          content: `Basado en esta búsqueda web, dame los videos más virales del nicho.\n\nBÚSQUEDA:\n${webCtx.slice(0, 3000)}\n\nNICHO: ${niche}\nPLATAFORMAS: ${platforms.join(', ')}\nIDIOMAS: ${languages.join(', ')}\nVIDEOS: ${count} por plataforma\n\nJSON (solo plataformas: ${platforms.join(', ')}):\n{"platforms":{"youtube":[{"title":"","creator":"","language":"","views":"","format":"","hook":"","why_viral":"","reference":""}]},"viral_formats":[""]}\n\n${count} videos por plataforma. Títulos en su idioma. Específico y real.`
        }]
      })
    });

    if (!analyzeRes.ok) {
      const errData = await analyzeRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API error ${analyzeRes.status}`);
    }

    const analyzeData = await analyzeRes.json();
    let raw = analyzeData.content.map(b => b.text || '').join('');
    raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('No se pudo parsear la respuesta de la IA.');
    }

    console.log(`[search] Análisis completado. Respondiendo al cliente.`);
    res.json({ ok: true, data: parsed, webContextLength: webCtx.length });

  } catch (err) {
    console.error('[search] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Catch-all: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Viral Finder corriendo en http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY no está configurada. Agrégala en .env o en las variables de entorno.');
  }
});
