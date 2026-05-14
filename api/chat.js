module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages } = req.body;

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
- Si el cliente da su teléfono, termina la conversación confirmando que le llamarán
- No inventes precios ni propiedades concretas
- Si preguntan por algo que no sabes, di que un agente le informará personalmente
CALCULADORA DE HIPOTECA:
Cuando el cliente mencione un presupuesto o pregunte por hipoteca, calcula la cuota mensual usando esta fórmula:
- Asume 80% de financiación (el banco no suele dar el 100%)
- Tipo de interés: 3.5% anual
- Plazo: 30 años
- Fórmula: cuota = (capital * interes_mensual) / (1 - (1 + interes_mensual)^-360)
- Ejemplo: piso de 200.000€ → capital 160.000€ → cuota ~718€/mes
Siempre muestra el cálculo de forma clara y añade que es orientativo.`;

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
