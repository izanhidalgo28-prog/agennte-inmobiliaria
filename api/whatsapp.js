const twilio = require('twilio');
const conversaciones = {};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const userMessage = req.body.Body.trim();
  const from = req.body.From;

  if (!conversaciones[from]) conversaciones[from] = { historial: [], datos: {}, leadGuardado: false };
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
    try {
      const client = twilio(TWILIO_SID, TWILIO_TOKEN);
      await client.messages.create({
        from: 'whatsapp:+14155238886',
        to: AGENTE_NUMERO,
        body: `Nuevo lead!\nNombre: ${datos.nombre}\nTelefono: ${datos.telefono}\nBusca: ${datos.busca}\nZona: ${datos.zona}\nPresupuesto: ${datos.presupuesto}\nCaracteristicas: ${datos.caracteristicas}`
      });
    } catch(e) { console.error('Twilio error:', e.message); }
  }

  async function guardarLead(datos) {
    try {
      const r = await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'lead',
          nombre: datos.nombre || '',
          telefono: datos.telefono || '',
          busca: datos.busca || '',
          zona: datos.zona || '',
          presupuesto: datos.presupuesto || '',
          caracteristicas: datos.caracteristicas || ''
        })
      });
      console.log('Sheets response:', r.status);
    } catch(e) { console.error('Sheets error:', e.message); }
  }

  const esTelefono = /^\d{9}$/.test(userMessage.replace(/\s/g,''));

  if (esTelefono && !conv.leadGuardado) {
    conv.datos.telefono = userMessage;
    conv.leadGuardado = true;
    await guardarLead(conv.datos);
    await notificarAgente(conv.datos);
    return responder('Perfecto, tengo todos tus datos. Un agente especializado te llamara en menos de 24 horas. Gracias por contactarnos!');
  }

  if (conv.leadGuardado) {
    return responder('Ya tenemos tus datos. Un agente te llamara pronto. Gracias!');
  }

  conv.historial.push({ role: 'user', content: userMessage });

  const txt = conv.historial.map(m => m.content).join(' ').toLowerCase();
  if (txt.includes('comprar')) conv.datos.busca = 'Comprar';
  if (txt.includes('alquilar')) conv.datos.busca = 'Alquilar';
  if (txt.includes('vender')) conv.datos.busca = 'Vender';

  const userMsgs = conv.historial.filter(m => m.role === 'user');
  if (userMsgs.length === 5) conv.datos.nombre = userMessage;

  const system = `Eres un agente de ventas inmobiliario virtual experto y amable. Tu objetivo es captar el interés del cliente y conseguir sus datos para que un agente humano le llame.

FLUJO ESTRICTO - sigue este orden exacto:
1. Pregunta que busca (comprar, alquilar, vender)
2. Pregunta zona o ciudad
3. Pregunta presupuesto
4. Pregunta características (habitaciones, garaje, terraza...)
5. Pide nombre completo
6. Pide numero de telefono de 9 digitos

IMPORTANTE: Cuando el cliente te dé su número de teléfono de 9 dígitos, NO respondas nada más - el sistema lo procesará automáticamente.

REGLAS:
- Responde en español
- Máximo 2 oraciones por respuesta
- Una sola pregunta a la vez
- No uses asteriscos ni markdown, solo texto plano`;

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
        max_tokens: 200,
        system,
        messages: conv.historial
      })
    });
    const data = await r.json();
    const reply = data.content[0].text;
    conv.historial.push({ role: 'assistant', content: reply });
    responder(reply);
  } catch(e) {
    responder('Lo siento, hubo un error. Intentalo de nuevo.');
  }
};
