const twilio = require('twilio');

const conversaciones = {};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const userMessage = req.body.Body.trim();
  const from = req.body.From;

  if (!conversaciones[from]) conversaciones[from] = { historial: [], datos: {} };
  const conv = conversaciones[from];

  const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxNJTkjcBXCG7JGMWNPy1pqglZiHOwqek8nBUu9xYGB3X0gm-soUohxkEnIKx8opORy/exec';
  const TWILIO_SID = 'AC86a36860c56d30c195c4c83a1ad6fd45';
  const TWILIO_TOKEN = 'f9e4f906049ed68e4d91ab5de1b96726';
  const AGENTE_NUMERO = 'whatsapp:+34684190200';

  function responder(texto) {
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(texto);
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(twiml.toString());
  }

  async function notificarAgente(datos) {
    const client = twilio(TWILIO_SID, TWILIO_TOKEN);
    const mensaje = `Nuevo lead inmobiliario!\nNombre: ${datos.nombre}\nTeléfono: ${datos.telefono}\nBusca: ${datos.busca}\nZona: ${datos.zona}\nPresupuesto: ${datos.presupuesto}\nCaracterísticas: ${datos.caracteristicas}`;
    await client.messages.create({
      from: 'whatsapp:+14155238886',
      to: AGENTE_NUMERO,
      body: mensaje
    }).catch(() => {});
  }

  async function guardarLead(datos) {
    await fetch(SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'lead',
        nombre: datos.nombre,
        telefono: datos.telefono,
        busca: datos.busca,
        zona: datos.zona,
        presupuesto: datos.presupuesto,
        caracteristicas: datos.caracteristicas
      })
    }).catch(() => {});
  }

  const system = `Eres un agente de ventas inmobiliario virtual experto y amable. Tu objetivo es captar el interés del cliente y conseguir sus datos para que un agente humano le llame.

FLUJO DE CONVERSACIÓN:
1. Saluda y pregunta qué busca (comprar, alquilar, vender)
2. Pregunta zona o ciudad de interés
3. Pregunta presupuesto aproximado
4. Pregunta características (habitaciones, garaje, terraza...)
5. Recoge nombre completo
6. Recoge teléfono
7. Confirma que le contactarán en menos de 24 horas

REGLAS:
- Responde siempre en español
- Sé cercano y profesional
- Máximo 2-3 oraciones por respuesta
- Haz solo UNA pregunta a la vez
- Cuando el cliente dé su teléfono, di exactamente: "LEAD_COMPLETO" al final de tu respuesta
- No inventes precios ni propiedades concretas
- No uses markdown, asteriscos ni formato especial, solo texto plano`;

  conv.historial.push({ role: 'user', content: userMessage });

  // Extraer datos del historial
  const textoCompleto = conv.historial.map(m => m.content).join(' ').toLowerCase();
  if (textoCompleto.includes('comprar')) conv.datos.busca = 'Comprar';
  if (textoCompleto.includes('alquilar')) conv.datos.busca = 'Alquilar';
  if (textoCompleto.includes('vender')) conv.datos.busca = 'Vender';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system,
        messages: conv.historial
      })
    });
    const data = await r.json();
    let reply = data.content[0].text;

    const estelefono = /\b\d{9}\b/.test(userMessage);
if (estelefono) {
      reply = reply.replace('LEAD_COMPLETO', '').trim();
      conv.datos.nombre = conv.datos.nombre || 'Sin nombre';
      conv.datos.telefono = userMessage;
      await guardarLead(conv.datos);
      await notificarAgente(conv.datos);
    }

    conv.historial.push({ role: 'assistant', content: reply });
    responder(reply);
  } catch (e) {
    responder('Lo siento, hubo un error. Inténtalo de nuevo.');
  }
};
