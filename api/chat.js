module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, inmoInfo } = req.body;

  const system = `Eres un agente de ventas virtual de ${inmoInfo?.nombre || 'una inmobiliaria'}.

INFORMACIÓN:
- Zona de trabajo: ${inmoInfo?.zona || 'Elche y alrededores'}
- Tipos de propiedades: ${inmoInfo?.propiedades || 'pisos, chalets, locales comerciales, terrenos'}
- Contacto: ${inmoInfo?.telefono || '000 000 000'}
- Email: ${inmoInfo?.email || 'info@inmobiliaria.com'}

TU OBJETIVO es calificar al cliente y conseguir sus datos para que un agente humano le contacte.

FLUJO QUE DEBES SEGUIR:
1. Saluda y pregunta qué busca
2. Pregunta si es para compra o alquiler
3. Pregunta el presupuesto aproximado
4. Pregunta la zona o barrio preferido
5. Pregunta cuándo podría hacer una visita
6. Pide su nombre y teléfono para que un agente le llame

REGLAS:
- Responde siempre en español, sé amable y profesional
- Máximo 2-3 oraciones por respuesta
- No inventes precios ni propiedades concretas
- Si el presupuesto es muy bajo para la zona, sé amable pero honesto
- Cuando tengas nombre y teléfono, confirma que un agente le contactará en menos de 2 horas
- No uses markdown, asteriscos ni formato especial, solo texto plano`;

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
        messages
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message });
    res.status(200).json({ reply: data.content[0].text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
