const twilio = require('twilio');
const conversaciones = {};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const userMessage = req.body.Body.trim();
  const from = req.body.From;

  if (!conversaciones[from]) conversaciones[from] = {
    paso: 0,
    datos: {},
    historial: [],
    leadGuardado: false
  };
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
      console.log('Lead guardado');
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
    return responder('Ya tenemos tus datos. Un agente te contactará pronto. Gracias!');
  }

  // Flujo paso a paso
  conv.paso++;

  if (conv.paso === 1) {
    return responder('Hola! Soy tu agente inmobiliario virtual. Estoy aquí para ayudarte. Cuéntame, buscas comprar, alquilar o vender una propiedad?');
  }
  if (conv.paso === 2) {
    conv.datos.busca = userMessage;
    return responder('Perfecto. En qué zona o ciudad te gustaría?');
  }
  if (conv.paso === 3) {
    conv.datos.zona = userMessage;
    return responder('Cuál es tu presupuesto aproximado?');
  }
  if (conv.paso === 4) {
    conv.datos.presupuesto = userMessage;
    return responder('Qué características buscas? Por ejemplo habitaciones, garaje, terraza...');
  }
  if (conv.paso === 5) {
    conv.datos.caracteristicas = userMessage;
    return responder('Cuál es tu nombre completo?');
  }
  if (conv.paso === 6) {
    conv.datos.nombre = userMessage;
    return responder('Por último, cuál es tu número de teléfono de 9 dígitos?');
  }
  if (conv.paso === 7) {
    conv.datos.telefono = userMessage;
    conv.leadGuardado = true;
    await guardarYNotificar();
    return responder(`Perfecto ${conv.datos.nombre}, tengo todos tus datos. Un agente especializado te llamará en menos de 24 horas. Gracias por contactarnos!`);
  }
};
