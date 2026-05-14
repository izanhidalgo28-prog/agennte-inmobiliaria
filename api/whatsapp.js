const twilio = require('twilio');

const conversaciones = {};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const userMessage = req.body.Body.trim();
  const from = req.body.From;

  if (!conversaciones[from]) conversaciones[from] = {};
  const conv = conversaciones[from];

  function responder(texto) {
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(texto);
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(twiml.toString());
  }

  const system = `Eres un agente de ventas inmobiliario virtual experto y amable. Tu objetivo es captar el interés del cliente y conseguir sus datos para que un agente humano le llame.

FLUJO DE CONVERSACIÓN:
1. Saluda y pregunta qué busca (comprar, alquilar, vender)
2. Pregunta zona o ciudad de interés
3. Pregunta presupuesto aproximado
4. Pregunta características (habitaciones, garaje, terraza...)
5. Recoge nombre y teléfono para que un agente le llame
6. Confirma que le contactarán en menos de 24 horas

REGLAS:
- Responde siempre en español
- Sé cercano y profesional
- Máximo 2-3 oraciones por respuesta
- Haz solo UNA pregunta a la vez
- Si el cliente da su teléfono, termina confirmando que le llamarán pronto
- No inventes precios ni propiedades concretas`;

  if (!conv.historial) conv.historial = [];
  conv.historial.push({ role: 'user', content: userMessage });

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
    const reply = data.content[0].text;
    conv.historial.push({ role: 'assistant', content: reply });
    responder(reply);
  } catch (e) {
    responder('Lo siento, hubo un error. Inténtalo de nuevo.');
  }
};
