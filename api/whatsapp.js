const twilio = require('twilio');
const { Redis } = require('@upstash/redis');
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ── Detección simple de idioma ──────────────────────────────────────
function detectarIdioma(texto) {
  const t = texto.toLowerCase();
  const palabrasIngles = ['hello','hi','house','flat','apartment','buy','sell','rent','price','budget','looking for','property','please','thanks','i want','i need','can you'];
  const palabrasAleman = ['hallo','haus','wohnung','kaufen','verkaufen','miete','preis','suche','bitte','danke','ich möchte','ich brauche','immobilie'];
  if (palabrasAleman.some(p => t.includes(p))) return 'de';
  if (palabrasIngles.some(p => t.includes(p))) return 'en';
  return 'es';
}

// ── Normalizar texto (quita acentos y pasa a minúsculas) ────────────
function normalizar(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Textos por idioma
const T = {
  es: {
    bienvenida: '¡Hola! Soy ALEX, tu agente inmobiliario virtual 🏡\n\n¿Qué necesitas?\n1️⃣ Comprar, alquilar o vender una propiedad\n2️⃣ Valorar mi inmueble',
    valorarInicio: 'Perfecto, voy a valorar tu inmueble. ¿Qué tipo de propiedad es? (piso / casa / chalet / local / otro)',
    venderZona: 'Entendido, quieres vender. ¿En qué zona está tu propiedad?',
    zonaPregunta: '¿En qué zona o ciudad te gustaría?',
    zonaInvalida: 'Por favor escribe una zona válida (ej: Elche centro, Altabix, Carrús...)',
    presupuestoPregunta: '¿Cuál es tu presupuesto aproximado? (solo el número, ej: 150000)',
    presupuestoInvalido: 'Por favor escribe solo el número, sin letras ni símbolos. Ej: 150000',
    caracteristicasPregunta: '¿Qué características buscas? Por ejemplo: 3 habitaciones, garaje, terraza...',
    caracteristicasInvalidas: 'Por favor describe las características que buscas (mínimo 2 caracteres)',
    nombrePregunta: '¿Cuál es tu nombre completo?',
    nombreInvalido: 'Por favor escribe tu nombre completo sin números',
    telefonoPregunta: 'Por último, ¿cuál es tu número de teléfono de 9 dígitos?',
    telefonoInvalido: 'El teléfono no parece válido. Escribe 9 dígitos empezando por 6, 7, 8 o 9. Ej: 612345678',
    leadGuardado: (nombre) => `Perfecto ${nombre} 🙌 Tus datos han quedado registrados. Un agente especializado te llamará en menos de 24 horas.\n\nMientras tanto puedo resolver cualquier duda sobre el mercado inmobiliario, hipotecas o zonas de Elche. ¿Alguna pregunta?`,
    propiedadesEncontradas: (n) => `🏠 He encontrado ${n} propiedad${n>1?'es':''} que puede${n>1?'n':''} interesarte:`,
    propiedadFicha: (p) => `📍 ${p.tipo} en ${p.zona}\n💰 ${Number(p.precio).toLocaleString('es-ES')}€\n🛏 ${p.habitaciones} hab · 🚿 ${p.banos} baños · 📐 ${p.metros}m²\n✨ ${p.caracteristicas}`,
    sinPropiedades: '📋 En este momento no tenemos propiedades en tu zona y presupuesto, pero un agente buscará personalmente para ti. ¿Tienes alguna otra pregunta?',
    holaDeNuevo: '¡Hola de nuevo! Tus datos ya están guardados y un agente te contactará pronto. Mientras tanto puedo resolver cualquier duda sobre el mercado inmobiliario. ¿En qué puedo ayudarte? 😊',
    agenteContacto: 'Perfecto, un agente se pondrá en contacto contigo pronto. Si tienes más preguntas sobre el mercado inmobiliario, aquí estoy 😊',
    reinicio: '¡Claro! Soy ALEX, tu agente inmobiliario virtual.\n\n¿Qué necesitas?\n1️⃣ Comprar, alquilar o vender una propiedad\n2️⃣ Valorar mi inmueble',
    valoracionPost: (val) => `Valoración de tu inmueble:\n\n${val}\n\n¿Tienes alguna otra pregunta? Puedo ayudarte con información sobre el mercado, hipotecas o zonas de Elche. Si quieres que un agente te contacte escribe "agente".`,
    errorValoracion: 'Lo siento, no pude calcular la valoración ahora mismo. Inténtalo de nuevo más tarde.',
    errorIA: 'Lo siento, no pude responder ahora mismo. Inténtalo de nuevo.',
    valorTipo: '¿En qué zona o barrio de Elche está el inmueble?',
    valorMetros: '¿Cuántos metros cuadrados tiene?',
    valorHabitaciones: '¿Cuántas habitaciones tiene?',
    valorBanos: '¿Cuántos baños tiene?',
    valorEstado: '¿En qué estado está? (nueva construcción / buen estado / a reformar)'
  },
  en: {
    bienvenida: 'Hi! I\'m ALEX, your virtual real estate agent 🏡\n\nWhat do you need?\n1️⃣ Buy, rent or sell a property\n2️⃣ Value my property',
    valorarInicio: 'Great, let\'s value your property. What type is it? (flat / house / villa / commercial / other)',
    venderZona: 'Got it, you want to sell. Which area is your property in?',
    zonaPregunta: 'Which area or city are you interested in?',
    zonaInvalida: 'Please write a valid area (e.g. Elche centre, Altabix, Carrús...)',
    presupuestoPregunta: 'What\'s your approximate budget? (just the number, e.g. 150000)',
    presupuestoInvalido: 'Please write just the number, no letters or symbols. E.g. 150000',
    caracteristicasPregunta: 'What features are you looking for? For example: 3 bedrooms, garage, terrace...',
    caracteristicasInvalidas: 'Please describe the features you\'re looking for (minimum 2 characters)',
    nombrePregunta: 'What\'s your full name?',
    nombreInvalido: 'Please write your full name without numbers',
    telefonoPregunta: 'Lastly, what\'s your phone number?',
    telefonoInvalido: 'That phone number doesn\'t look valid. Please write a valid Spanish number, e.g. 612345678',
    leadGuardado: (nombre) => `Perfect ${nombre} 🙌 Your details have been registered. A specialised agent will call you within 24 hours.\n\nMeanwhile, I can help with any questions about the real estate market, mortgages or areas in Elche. Any questions?`,
    propiedadesEncontradas: (n) => `🏠 I found ${n} propert${n>1?'ies':'y'} that might interest you:`,
    propiedadFicha: (p) => `📍 ${p.tipo} in ${p.zona}\n💰 €${Number(p.precio).toLocaleString('en-GB')}\n🛏 ${p.habitaciones} bed · 🚿 ${p.banos} bath · 📐 ${p.metros}m²\n✨ ${p.caracteristicas}`,
    sinPropiedades: '📋 We don\'t currently have properties matching your area and budget, but an agent will search personally for you. Any other questions?',
    holaDeNuevo: 'Hi again! Your details are already saved and an agent will contact you soon. Meanwhile, I can help with any real estate questions. How can I help? 😊',
    agenteContacto: 'Great, an agent will contact you soon. If you have more questions about the real estate market, I\'m here 😊',
    reinicio: 'Sure! I\'m ALEX, your virtual real estate agent.\n\nWhat do you need?\n1️⃣ Buy, rent or sell a property\n2️⃣ Value my property',
    valoracionPost: (val) => `Property valuation:\n\n${val}\n\nAny other questions? I can help with market info, mortgages or areas in Elche. If you'd like an agent to contact you, write "agent".`,
    errorValoracion: 'Sorry, I couldn\'t calculate the valuation right now. Please try again later.',
    errorIA: 'Sorry, I couldn\'t respond right now. Please try again.',
    valorTipo: 'Which area or neighbourhood in Elche is the property in?',
    valorMetros: 'How many square metres is it?',
    valorHabitaciones: 'How many bedrooms does it have?',
    valorBanos: 'How many bathrooms does it have?',
    valorEstado: 'What condition is it in? (new build / good condition / needs renovation)'
  },
  de: {
    bienvenida: 'Hallo! Ich bin ALEX, Ihr virtueller Immobilienmakler 🏡\n\nWas brauchen Sie?\n1️⃣ Kaufen, mieten oder verkaufen\n2️⃣ Meine Immobilie bewerten',
    valorarInicio: 'Perfekt, lassen Sie uns Ihre Immobilie bewerten. Welcher Typ ist es? (Wohnung / Haus / Villa / Gewerbe / Sonstiges)',
    venderZona: 'Verstanden, Sie möchten verkaufen. In welcher Gegend liegt Ihre Immobilie?',
    zonaPregunta: 'In welcher Gegend oder Stadt suchen Sie?',
    zonaInvalida: 'Bitte geben Sie eine gültige Gegend an (z.B. Elche Zentrum, Altabix, Carrús...)',
    presupuestoPregunta: 'Wie hoch ist Ihr ungefähres Budget? (nur die Zahl, z.B. 150000)',
    presupuestoInvalido: 'Bitte schreiben Sie nur die Zahl, ohne Buchstaben oder Symbole. Z.B. 150000',
    caracteristicasPregunta: 'Welche Merkmale suchen Sie? Zum Beispiel: 3 Schlafzimmer, Garage, Terrasse...',
    caracteristicasInvalidas: 'Bitte beschreiben Sie die gesuchten Merkmale (mindestens 2 Zeichen)',
    nombrePregunta: 'Wie ist Ihr vollständiger Name?',
    nombreInvalido: 'Bitte schreiben Sie Ihren vollständigen Namen ohne Zahlen',
    telefonoPregunta: 'Zuletzt, wie ist Ihre Telefonnummer?',
    telefonoInvalido: 'Diese Telefonnummer scheint ungültig. Bitte geben Sie eine gültige spanische Nummer an, z.B. 612345678',
    leadGuardado: (nombre) => `Perfekt ${nombre} 🙌 Ihre Daten wurden registriert. Ein spezialisierter Makler wird Sie innerhalb von 24 Stunden anrufen.\n\nIn der Zwischenzeit helfe ich gerne bei Fragen zum Immobilienmarkt, Hypotheken oder Gegenden in Elche. Haben Sie Fragen?`,
    propiedadesEncontradas: (n) => `🏠 Ich habe ${n} Immobilie${n>1?'n':''} gefunden, die Sie interessieren könnte${n>1?'n':''}:`,
    propiedadFicha: (p) => `📍 ${p.tipo} in ${p.zona}\n💰 ${Number(p.precio).toLocaleString('de-DE')}€\n🛏 ${p.habitaciones} Zi. · 🚿 ${p.banos} Bad · 📐 ${p.metros}m²\n✨ ${p.caracteristicas}`,
    sinPropiedades: '📋 Wir haben derzeit keine Immobilien in Ihrer Zone und Ihrem Budget, aber ein Makler wird persönlich für Sie suchen. Haben Sie weitere Fragen?',
    holaDeNuevo: 'Hallo wieder! Ihre Daten sind bereits gespeichert und ein Makler wird Sie bald kontaktieren. In der Zwischenzeit helfe ich gerne bei Immobilienfragen. Wie kann ich helfen? 😊',
    agenteContacto: 'Perfekt, ein Makler wird Sie bald kontaktieren. Wenn Sie weitere Fragen zum Immobilienmarkt haben, bin ich hier 😊',
    reinicio: 'Klar! Ich bin ALEX, Ihr virtueller Immobilienmakler.\n\nWas brauchen Sie?\n1️⃣ Kaufen, mieten oder verkaufen\n2️⃣ Meine Immobilie bewerten',
    valoracionPost: (val) => `Immobilienbewertung:\n\n${val}\n\nHaben Sie weitere Fragen? Ich helfe gerne mit Marktinformationen, Hypotheken oder Gegenden in Elche. Wenn Sie von einem Makler kontaktiert werden möchten, schreiben Sie "Makler".`,
    errorValoracion: 'Entschuldigung, ich konnte die Bewertung gerade nicht berechnen. Bitte versuchen Sie es später erneut.',
    errorIA: 'Entschuldigung, ich konnte gerade nicht antworten. Bitte versuchen Sie es erneut.',
    valorTipo: 'In welcher Gegend oder Nachbarschaft in Elche liegt die Immobilie?',
    valorMetros: 'Wie viele Quadratmeter hat sie?',
    valorHabitaciones: 'Wie viele Schlafzimmer hat sie?',
    valorBanos: 'Wie viele Badezimmer hat sie?',
    valorEstado: 'In welchem Zustand ist sie? (Neubau / guter Zustand / renovierungsbedürftig)'
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const userMessage = req.body.Body.trim();
  const from = req.body.From;
  const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxNJTkjcBXCG7JGMWNPy1pqglZiHOwqek8nBUu9xYGB3X0gm-soUohxkEnIKx8opORy/exec';
  const TWILIO_SID = 'AC86a36860c56d30c195c4c83a1ad6fd45';
  const TWILIO_TOKEN = '3a63515a6a1ce991d03a3cd8df1517fc';
  const AGENTE_NUMERO = 'whatsapp:+34684190200';

  let conv = await redis.get(from);
  if (!conv) conv = { paso: 0, datos: {}, leadGuardado: false, idioma: null };
  if (!conv.idioma) conv.idioma = detectarIdioma(userMessage);
  const L = T[conv.idioma] || T.es;

  async function guardarEstado() {
    await redis.set(from, conv, { ex: 86400 });
  }

  function responder(texto) {
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(texto);
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(twiml.toString());
  }

  // ── BUSCAR PROPIEDADES COINCIDENTES (con normalización de acentos) ─
  async function buscarPropiedades(zona, presupuesto) {
    try {
      const r = await fetch(SHEETS_URL + '?sheet=propiedades');
      const props = await r.json();
      if (!Array.isArray(props)) return [];
      const presupuestoNum = parseInt(presupuesto.replace(/[^0-9]/g,''));
      const zonaNorm = normalizar(zona);
      return props.filter(p => {
        const precioOk = Number(p.precio) <= presupuestoNum;
        const zonaPropNorm = normalizar(p.zona);
        const zonaOk = zonaPropNorm.includes(zonaNorm) || zonaNorm.includes(zonaPropNorm);
        return precioOk && zonaOk;
      }).slice(0, 3);
    } catch(e) {
      console.error('Error buscando propiedades:', e.message);
      return [];
    }
  }

  async function guardarYNotificar() {
    try {
      await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'lead',
          nombre: conv.datos.nombre || '',
          telefono: conv.datos.telefono || '',
          busca: conv.datos.busca || '',
          zona: conv.datos.zona || '',
          presupuesto: conv.datos.presupuesto || '',
          caracteristicas: conv.datos.caracteristicas || ''
        })
      });
    } catch(e) { console.error('Sheets error:', e.message); }

    try {
      const client = twilio(TWILIO_SID, TWILIO_TOKEN);
      await client.messages.create({
        from: 'whatsapp:+14155238886',
        to: AGENTE_NUMERO,
        body: `Nuevo lead! (idioma: ${conv.idioma})\nNombre: ${conv.datos.nombre}\nTelefono: ${conv.datos.telefono}\nBusca: ${conv.datos.busca}\nZona: ${conv.datos.zona}\nPresupuesto: ${conv.datos.presupuesto}\nCaracteristicas: ${conv.datos.caracteristicas}`
      });
    } catch(e) { console.error('Twilio error agente:', e.message); }

    try {
      const propiedades = await buscarPropiedades(conv.datos.zona, conv.datos.presupuesto);
      const client = twilio(TWILIO_SID, TWILIO_TOKEN);
      if (propiedades.length > 0) {
        await client.messages.create({
          from: 'whatsapp:+14155238886',
          to: from,
          body: L.propiedadesEncontradas(propiedades.length)
        });
        for (const p of propiedades) {
          await client.messages.create({
            from: 'whatsapp:+14155238886',
            to: from,
            body: L.propiedadFicha(p)
          });
        }
      } else {
        await client.messages.create({
          from: 'whatsapp:+14155238886',
          to: from,
          body: L.sinPropiedades
        });
      }
    } catch(e) { console.error('Twilio error propiedades:', e.message); }
  }

  async function consultarIA(pregunta) {
    const systemPorIdioma = {
      es: `Eres ALEX, un agente inmobiliario virtual experto en el mercado de Elche y alrededores (Alicante, España). Ayudas a compradores, vendedores e inversores con información sobre precios, zonas, hipotecas y el proceso de compraventa. Responde en español, de forma cercana y profesional, variando tu forma de expresarte para no sonar repetitivo. Máximo 3-4 oraciones. No inventes datos concretos de propiedades específicas. Si alguien quiere comprar, vender o alquilar, indícale que escriba "inicio" para empezar el proceso.`,
      en: `You are ALEX, a virtual real estate agent expert in the Elche area market (Alicante, Spain). You help buyers, sellers and investors with information about prices, areas, mortgages and the buying/selling process. Reply in English, in a warm and professional tone, varying your wording naturally. Maximum 3-4 sentences. Don't invent specific data about particular properties. If someone wants to buy, sell or rent, tell them to write "start" to begin the process.`,
      de: `Sie sind ALEX, ein virtueller Immobilienmakler und Experte für den Markt in Elche und Umgebung (Alicante, Spanien). Sie helfen Käufern, Verkäufern und Investoren mit Informationen zu Preisen, Gegenden, Hypotheken und dem Kauf-/Verkaufsprozess. Antworten Sie auf Deutsch, freundlich und professionell, mit natürlicher Variation in der Wortwahl. Maximal 3-4 Sätze. Erfinden Sie keine konkreten Daten zu bestimmten Immobilien. Wenn jemand kaufen, verkaufen oder mieten möchte, sagen Sie ihm, er solle "Start" schreiben, um den Prozess zu beginnen.`
    };
    const system = systemPorIdioma[conv.idioma] || systemPorIdioma.es;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 300, system, messages: [{ role: 'user', content: pregunta }] })
    });
    const data = await response.json();
    return data.content[0].text;
  }

  async function valorarConIA() {
    const d = conv.datos;
    const promptPorIdioma = {
      es: `Eres un experto inmobiliario en Elche, España. Estima el precio de venta de este inmueble basándote en el mercado actual de Elche:\n- Tipo: ${d.tipo}\n- Zona/barrio: ${d.zonaValor}\n- Metros cuadrados: ${d.metros}\n- Habitaciones: ${d.habitaciones}\n- Baños: ${d.banos}\n- Estado: ${d.estado}\n\nDa una estimación realista con un rango de precio (mínimo y máximo) y una breve explicación de 2-3 líneas. Responde en español, de forma concisa y directa, sin preámbulos.`,
      en: `You are a real estate expert in Elche, Spain. Estimate the sale price of this property based on the current Elche market:\n- Type: ${d.tipo}\n- Area: ${d.zonaValor}\n- Square metres: ${d.metros}\n- Bedrooms: ${d.habitaciones}\n- Bathrooms: ${d.banos}\n- Condition: ${d.estado}\n\nGive a realistic estimate with a price range (minimum and maximum) and a brief 2-3 line explanation. Reply in English, concisely and directly, no preamble.`,
      de: `Sie sind ein Immobilienexperte in Elche, Spanien. Schätzen Sie den Verkaufspreis dieser Immobilie basierend auf dem aktuellen Markt in Elche:\n- Typ: ${d.tipo}\n- Gegend: ${d.zonaValor}\n- Quadratmeter: ${d.metros}\n- Schlafzimmer: ${d.habitaciones}\n- Badezimmer: ${d.banos}\n- Zustand: ${d.estado}\n\nGeben Sie eine realistische Schätzung mit einer Preisspanne (Minimum und Maximum) und einer kurzen Erklärung von 2-3 Zeilen. Antworten Sie auf Deutsch, prägnant und direkt, ohne Einleitung.`
    };
    const prompt = promptPorIdioma[conv.idioma] || promptPorIdioma.es;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    return data.content[0].text;
  }

  function esTelefonoValido(t) { return /^[6789]\d{8}$/.test(t.replace(/\s/g,'')); }
  function esNumeroValido(n) { return /^\d+$/.test(n.replace(/\s/g,'')); }
  function esTextoValido(t) { return t.length >= 2 && t.length <= 100; }

  if (conv.modo === 'valoracion') {
    if (conv.paso === 11) { conv.datos.tipo = userMessage; conv.paso = 12; await guardarEstado(); return responder(L.valorTipo); }
    if (conv.paso === 12) { conv.datos.zonaValor = userMessage; conv.paso = 13; await guardarEstado(); return responder(L.valorMetros); }
    if (conv.paso === 13) { conv.datos.metros = userMessage; conv.paso = 14; await guardarEstado(); return responder(L.valorHabitaciones); }
    if (conv.paso === 14) { conv.datos.habitaciones = userMessage; conv.paso = 15; await guardarEstado(); return responder(L.valorBanos); }
    if (conv.paso === 15) { conv.datos.banos = userMessage; conv.paso = 16; await guardarEstado(); return responder(L.valorEstado); }
    if (conv.paso === 16) {
      conv.datos.estado = userMessage; await guardarEstado();
      try {
        const valoracion = await valorarConIA();
        conv.modo = 'consulta'; conv.leadGuardado = true; await guardarEstado();
        return responder(L.valoracionPost(valoracion));
      } catch(e) { return responder(L.errorValoracion); }
    }
  }

  if (conv.modo === 'consulta') {
    const msg = userMessage.toLowerCase();
    if (msg.includes('agente') || msg.includes('contactar') || msg.includes('llamar') || msg.includes('agent') || msg.includes('contact') || msg.includes('makler') || msg.includes('kontakt')) return responder(L.agenteContacto);
    if (msg === 'inicio' || msg === 'start' || msg === 'reset') { await redis.del(from); return responder(L.reinicio); }
    try { return responder(await consultarIA(userMessage)); } catch(e) { return responder(L.errorIA); }
  }

  if (conv.leadGuardado && conv.modo !== 'consulta') { conv.modo = 'consulta'; await guardarEstado(); return responder(L.holaDeNuevo); }

  if (conv.paso === 0) { conv.paso = 1; await guardarEstado(); return responder(L.bienvenida); }

  if (conv.paso === 1) {
    const msg = userMessage.toLowerCase();
    if (msg.includes('valor') || msg.includes('2') || msg.includes('value') || msg.includes('bewert')) { conv.modo = 'valoracion'; conv.paso = 11; await guardarEstado(); return responder(L.valorarInicio); }
    if (msg.includes('vender') || msg.includes('sell') || msg.includes('verkauf')) { conv.datos.busca = 'Vender propiedad'; conv.paso = 2; await guardarEstado(); return responder(L.venderZona); }
    conv.datos.busca = userMessage; conv.paso = 2; await guardarEstado(); return responder(L.zonaPregunta);
  }

  if (conv.paso === 2) {
    if (!esTextoValido(userMessage)) return responder(L.zonaInvalida);
    conv.datos.zona = userMessage; conv.paso = 3; await guardarEstado(); return responder(L.presupuestoPregunta);
  }

  if (conv.paso === 3) {
    const limpio = userMessage.replace(/[€.\s]/g,'');
    if (!esNumeroValido(limpio)) return responder(L.presupuestoInvalido);
    conv.datos.presupuesto = limpio + '€'; conv.paso = 4; await guardarEstado(); return responder(L.caracteristicasPregunta);
  }

  if (conv.paso === 4) {
    if (!esTextoValido(userMessage)) return responder(L.caracteristicasInvalidas);
    conv.datos.caracteristicas = userMessage; conv.paso = 5; await guardarEstado(); return responder(L.nombrePregunta);
  }

  if (conv.paso === 5) {
    if (!esTextoValido(userMessage) || /\d/.test(userMessage)) return responder(L.nombreInvalido);
    conv.datos.nombre = userMessage; conv.paso = 6; await guardarEstado(); return responder(L.telefonoPregunta);
  }

  if (conv.paso === 6) {
    if (!esTelefonoValido(userMessage)) return responder(L.telefonoInvalido);
    conv.datos.telefono = userMessage.replace(/\s/g,'');
    conv.leadGuardado = true; conv.modo = 'consulta'; await guardarEstado();
    await guardarYNotificar();
    return responder(L.leadGuardado(conv.datos.nombre));
  }
};
