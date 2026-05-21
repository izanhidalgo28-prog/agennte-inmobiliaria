const twilio = require('twilio');
const { Redis } = require('@upstash/redis');
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const userMessage = req.body.Body.trim();
  const from = req.body.From;
  const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxNJTkjcBXCG7JGMWNPy1pqglZiHOwqek8nBUu9xYGB3X0gm-soUohxkEnIKx8opORy/exec';
  const TWILIO_SID = 'AC86a36860c56d30c195c4c83a1ad6fd45';
  const TWILIO_TOKEN = 'f9e4f906049ed68e4d91ab5de1b96726';
  const AGENTE_NUMERO = 'whatsapp:+34684190200';

  let conv = await redis.get(from);
  if (!conv) conv = { paso: 0, datos: {}, leadGuardado: false };

  async function guardarEstado() {
    await redis.set(from, conv, { ex: 86400 });
  }

  function responder(texto) {
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(texto);
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(twiml.toString());
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
        body: `Nuevo lead!\nNombre: ${conv.datos.nombre}\nTelefono: ${conv.datos.telefono}\nBusca: ${conv.datos.busca}\nZona: ${conv.datos.zona}\nPresupuesto: ${conv.datos.presupuesto}\nCaracteristicas: ${conv.datos.caracteristicas}`
      });
    } catch(e) { console.error('Twilio error:', e.message); }
  }

  async function valorarConIA() {
    const d = conv.datos;
    const prompt = `Eres un experto inmobiliario en Elche, España. 
Estima el precio de venta de este inmueble basándote en el mercado actual de Elche:
- Tipo: ${d.tipo}
- Zona/barrio: ${d.zonaValor}
- Metros cuadrados: ${d.metros}
- Habitaciones: ${d.habitaciones}
- Baños: ${d.banos}
- Estado: ${d.estado}

Da una estimación realista con un rango de precio (mínimo y máximo) y una breve explicación de 2-3 líneas. 
Responde en español, de forma concisa y directa, sin preámbulos.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    return data.content[0].text;
  }

  // ── MODO VALORACIÓN ──────────────────────────────────────────

  if (conv.modo === 'valoracion') {
    if (conv.paso === 11) {
      conv.datos.tipo = userMessage;
      conv.paso = 12;
      await guardarEstado();
      return responder('¿En qué zona o barrio de Elche está el inmueble?');
    }
    if (conv.paso === 12) {
      conv.datos.zonaValor = userMessage;
      conv.paso = 13;
      await guardarEstado();
      return responder('¿Cuántos metros cuadrados tiene?');
    }
    if (conv.paso === 13) {
      conv.datos.metros = userMessage;
      conv.paso = 14;
      await guardarEstado();
      return responder('¿Cuántas habitaciones tiene?');
    }
    if (conv.paso === 14) {
      conv.datos.habitaciones = userMessage;
      conv.paso = 15;
      await guardarEstado();
      return responder('¿Cuántos baños tiene?');
    }
    if (conv.paso === 15) {
      conv.datos.banos = userMessage;
      conv.paso = 16;
      await guardarEstado();
      return responder('¿En qué estado está? (nueva construcción / buen estado / a reformar)');
    }
    if (conv.paso === 16) {
      conv.datos.estado = userMessage;
      await guardarEstado();
      try {
        const valoracion = await valorarConIA();
        // Resetear conversación
        await redis.del(from);
        return responder(`Valoración de tu inmueble:\n\n${valoracion}\n\n¿Quieres que un agente te contacte para una valoración más detallada? Responde SI o NO.`);
      } catch(e) {
        console.error('Error IA:', e.message);
        return responder('Lo siento, no pude calcular la valoración ahora mismo. Inténtalo de nuevo más tarde.');
      }
    }
  }

  // Helpers de validación
  function esTelefonoValido(t) {
    return /^[6789]\d{8}$/.test(t.replace(/\s/g,''));
  }
  function esNumeroValido(n) {
    return /^\d+$/.test(n.replace(/\s/g,''));
  }
  function esTextoValido(t) {
    return t.length >= 2 && t.length <= 100;
  }

  // ── FLUJO PRINCIPAL ──────────────────────────────────────────

  if (conv.leadGuardado) {
    return responder('Ya tenemos tus datos. Un agente te contactara pronto. Gracias!');
  }

  if (conv.paso === 0) {
    conv.paso = 1;
    await guardarEstado();
    return responder('Hola! Soy tu agente inmobiliario virtual.\n\n¿Qué necesitas?\n1️⃣ Comprar, alquilar o vender una propiedad\n2️⃣ Valorar mi inmueble');
  }

  if (conv.paso === 1) {
    const msg = userMessage.toLowerCase();
    if (msg.includes('valor') || msg.includes('2')) {
      conv.modo = 'valoracion';
      conv.paso = 11;
      await guardarEstado();
      return responder('Perfecto! Voy a valorar tu inmueble. ¿Qué tipo de propiedad es? (piso / casa / chalet / local / otro)');
    }
    conv.datos.busca = userMessage;
    conv.paso = 2;
    await guardarEstado();
    return responder('En que zona o ciudad te gustaria?');
  }

  if (conv.paso === 2) {
    if (!esTextoValido(userMessage)) {
      return responder('Por favor escribe una zona válida (ej: Elche centro, Altabix, Carrús...)');
    }
    conv.datos.zona = userMessage;
    conv.paso = 3;
    await guardarEstado();
    return responder('Cual es tu presupuesto aproximado? (solo el número, ej: 150000)');
  }

  if (conv.paso === 3) {
    const limpio = userMessage.replace(/[€.\s]/g,'');
    if (!esNumeroValido(limpio)) {
      return responder('Por favor escribe solo el número, sin letras ni símbolos. Ej: 150000');
    }
    conv.datos.presupuesto = limpio + '€';
    conv.paso = 4;
    await guardarEstado();
    return responder('Que caracteristicas buscas? Por ejemplo: 3 habitaciones, garaje, terraza...');
  }

  if (conv.paso === 4) {
    if (!esTextoValido(userMessage)) {
      return responder('Por favor describe las características que buscas (mínimo 2 caracteres)');
    }
    conv.datos.caracteristicas = userMessage;
    conv.paso = 5;
    await guardarEstado();
    return responder('Cual es tu nombre completo?');
  }

  if (conv.paso === 5) {
    if (!esTextoValido(userMessage) || /\d/.test(userMessage)) {
      return responder('Por favor escribe tu nombre completo sin números');
    }
    conv.datos.nombre = userMessage;
    conv.paso = 6;
    await guardarEstado();
    return responder('Por ultimo, cual es tu numero de telefono de 9 digitos?');
  }

  if (conv.paso === 6) {
    if (!esTelefonoValido(userMessage)) {
      return responder('El teléfono no parece válido. Escribe 9 dígitos empezando por 6, 7, 8 o 9. Ej: 612345678');
    }
    conv.datos.telefono = userMessage.replace(/\s/g,'');
    conv.leadGuardado = true;
    await guardarEstado();
    await guardarYNotificar();
    return responder(`Perfecto ${conv.datos.nombre}, tengo todos tus datos. Un agente especializado te llamara en menos de 24 horas. Gracias por contactarnos!`);
  }
