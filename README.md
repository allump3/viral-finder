# 🔥 Viral Finder

Busca videos virales en tendencia por nicho y plataforma usando búsqueda web real con IA.

---

## 🚀 Deploy en Railway (recomendado — gratis)

1. **Crea cuenta** en https://railway.app (puedes entrar con GitHub)

2. **Sube el código a GitHub**
   - Crea un repo nuevo en https://github.com/new
   - Sube todos estos archivos (arrastra la carpeta o usa git)

3. **Crea un proyecto en Railway**
   - Click en "New Project" → "Deploy from GitHub repo"
   - Selecciona tu repo

4. **Agrega la variable de entorno**
   - En tu proyecto Railway → pestaña "Variables"
   - Agrega: `ANTHROPIC_API_KEY` = tu key de https://console.anthropic.com/settings/keys

5. **Listo** — Railway detecta el `package.json` automáticamente y despliega.
   - Te dará una URL tipo `https://viral-finder-production.up.railway.app`

---

## 🌐 Deploy en Render (alternativa gratis)

1. Crea cuenta en https://render.com
2. "New Web Service" → conecta tu repo de GitHub
3. Build command: `npm install`
4. Start command: `npm start`
5. Agrega variable de entorno: `ANTHROPIC_API_KEY`

---

## 💻 Correr en local (tu computadora)

### Requisitos
- Node.js 18+ instalado (https://nodejs.org)

### Pasos

```bash
# 1. Entra a la carpeta
cd viral-finder

# 2. Instala dependencias
npm install

# 3. Crea el archivo .env
cp .env.example .env
# Abre .env y pon tu ANTHROPIC_API_KEY real

# 4. Corre el servidor
npm start

# 5. Abre en tu navegador
# http://localhost:3000
```

---

## 🔑 API Key de Anthropic

1. Ve a https://console.anthropic.com/settings/keys
2. Click "Create Key"
3. Copia la key (empieza con `sk-ant-...`)
4. Pégala en Railway/Render como variable de entorno, o en `.env` para local

**Costo estimado:** cada búsqueda usa ~8,000-12,000 tokens. A los precios de Claude Sonnet son aproximadamente $0.02-0.04 USD por búsqueda.

---

## 📁 Estructura del proyecto

```
viral-finder/
├── server.js          # Backend Express — llama a la API de Anthropic
├── package.json       # Dependencias
├── .env.example       # Plantilla de variables de entorno
├── .gitignore         # Excluye .env y node_modules
└── public/
    └── index.html     # Frontend completo
```

---

## ❓ Preguntas frecuentes

**¿Por qué no funciona en el artifact de Claude.ai?**
El ambiente de artifacts tiene límites de tiempo en peticiones de red. En un servidor real las llamadas a la API no tienen ese problema.

**¿Cuánto tarda una búsqueda?**
Entre 30 y 90 segundos dependiendo del nicho y número de plataformas. El servidor no tiene timeout.

**¿Los videos son reales?**
La IA hace búsqueda web real y prioriza videos encontrados. Si no encuentra un video específico, genera uno representativo basado en patrones reales del nicho.
