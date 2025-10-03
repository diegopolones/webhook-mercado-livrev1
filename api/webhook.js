module.exports = async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log('=== 🚀 WEBHOOK RECEBIDO ===');
  console.log('Método:', req.method);
  
  try {
    if (req.method === 'POST') {
      const body = await readBody(req);
      console.log('📦 Notificação:', body);
      
      return res.status(200).json({ 
        status: 'OK', 
        message: 'Notificação recebida',
        timestamp: new Date().toISOString()
      });
    }
    
    // Resposta para GET
    return res.status(200).json({ 
      status: 'ONLINE', 
      message: 'Webhook Mercado Livre - Pronto para produção',
      webhook_url: 'https://webhook-mercado-livrev1.vercel.app/api/webhook'
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Helper para ler o body
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve(body);
      }
    });
  });
}
