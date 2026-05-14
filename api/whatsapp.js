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

  // Cargar estado desde Redis
  let conv = await redis.get(from);
  if (!conv) conv = { paso: 0, datos: {}, leadGuardado: false };

  async function guardarEstado() {
    await redis.set(from, conv, { ex: 86400 }); // expira en 24h
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

  if (conv.leadGuardado) {
    return responder('Ya tenemos tus datos. Un agente te contactara pronto. Gracias!');
  }

  if (conv.paso === 0) {
    conv.paso = 1;
    await guardarEstado();
    return responder('Hola! Soy tu agente inmobiliario virtual. Buscas comprar, alquilar o vender una propiedad?');
  }

  if (conv.paso === 1) {
    conv.datos.busca = userMessage;
    conv.paso = 2;
    await guardarEstado();
    return responder('En que zona o ciudad te gustaria?');
  }
  if (conv.paso === 2) {
    conv.datos.zona = userMessage;
    conv.paso = 3;
    await guardarEstado();
    return responder('Cual es tu presupuesto aproximado?');
  }
  if (conv.paso === 3) {
    conv.datos.presupuesto = userMessage;
    conv.paso = 4;
    await guardarEstado();
    return responder('Que caracteristicas buscas? Por ejemplo habitaciones, garaje, terraza...');
  }
  if (conv.paso === 4) {
    conv.datos.caracteristicas = userMessage;
    conv.paso = 5;
    await guardarEstado();
    return responder('Cual es tu nombre completo?');
  }
  if (conv.paso === 5) {
    conv.datos.nombre = userMessage;
    conv.paso = 6;
    await guardarEstado();
    return responder('Por ultimo, cual es tu numero de telefono de 9 digitos?');
  }
  if (conv.paso === 6) {
    conv.datos.telefono = userMessage;
    conv.leadGuardado = true;
    await guardarEstado();
    await guardarYNotificar();
    return responder(`Perfecto ${conv.datos.nombre}, tengo todos tus datos. Un agente especializado te llamara en menos de 24 horas. Gracias por contactarnos!`);
  }
};
