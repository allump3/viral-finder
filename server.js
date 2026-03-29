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
          content: `Busca en internet los videos más virales y en tendencia del nicho "${niche}" en estas plataformas: ${platforms.join(', ')}. 
Sub-nichos: ${sub || 'no especificado'}. 
Audiencia: ${audience || 'no especificada'}. 
Idiomas: ${languages.join(', ')}.
Necesito: títulos reales de videos virales, nombres de creadores que dominan el nicho, formatos que más funcionan, rangos de vistas reales, y qué ganchos generan más engagement en 2024-2025. 
Haz varias búsquedas para cubrir cada plataforma solicitada.`
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
        max_tokens: 5000,
        system: 'Eres un experto en análisis de contenido viral. Responde SOLO con JSON válido, sin texto adicional, sin bloques de código markdown.',
        messages: [{
          role: 'user',
          content: `Con base en esta investigación web, identifica los videos más virales en tendencia.

=== RESULTADOS DE BÚSQUEDA WEB ===
${webCtx}
=== FIN ===

NICHO: ${niche}
SUB-NICHOS: ${sub || 'no especificado'}
AUDIENCIA: ${audience || 'no especificada'}
PLATAFORMAS: ${platforms.join(', ')}
IDIOMAS: ${languages.join(', ')}
VIDEOS POR PLATAFORMA: ${count}

Devuelve exactamente este JSON (solo las plataformas solicitadas: ${platforms.join(', ')}):
{
  "platforms": {
    "youtube": [
      {
        "title": "Título real o representativo del video viral",
        "creator": "Nombre del creador o canal",
        "language": "Español",
        "views": "Rango de vistas (ej: 2.3M, 800K-1.5M)",
        "format": "Formato exacto (storytime, tutorial, reto, exposé, versus, Q&A, etc.)",
        "hook": "El gancho o ángulo que lo hizo viral en 1 frase",
        "why_viral": "Por qué funcionó — mecanismo psicológico o social",
        "reference": "Búsqueda sugerida para encontrarlo"
      }
    ]
  },
  "viral_formats": ["formato 1", "formato 2", "formato 3", "formato 4", "formato 5", "formato 6", "formato 7", "formato 8"]
}

REGLAS:
- Prioriza videos REALES encontrados en la búsqueda web
- ${count} videos por plataforma, SOLO: ${platforms.join(', ')}
- Distribuye idiomas: ${languages.join(', ')}
- Títulos en el idioma indicado en "language"
- Muy específico, nada genérico`
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
