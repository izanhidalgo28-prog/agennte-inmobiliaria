module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, clinicInfo } = req.body;

  const system = `Eres el asistente virtual de ${clinicInfo?.nombre || 'una clínica'}. 
Especialidades: ${clinicInfo?.especialidades || 'Medicina general, Cardiología, Pediatría'}.
Horarios: ${clinicInfo?.horarios || 'Lunes a Viernes 8am-8pm'}.
Teléfono: ${clinicInfo?.telefono || '800-000-0000'}.
Precios: ${clinicInfo?.precios || 'Consulta general desde $350'}.
Seguros: ${clinicInfo?.seguros || 'GNP, AXA, Metlife'}.
Responde siempre en español, sé amable y conciso. Máximo 2-3 oraciones. No des diagnósticos médicos.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
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
