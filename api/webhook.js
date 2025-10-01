export default async function handler(req, res) {
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
      
      // Processar notificação
      const resultado = await processarNotificacao(body);
      
      return res.status(200).json({ 
        status: 'OK', 
        message: 'Notificação processada com sucesso',
        timestamp: new Date().toISOString(),
        processado: resultado
      });
    }
    
    // Resposta para GET
    return res.status(200).json({ 
      status: 'ONLINE', 
      message: 'Webhook Mercado Livre - Pronto para produção',
      webhook_url: 'https://webhook-mercado-livrev1.vercel.app/api/webhook',
      next_steps: [
        '1. Configurar evento "shipment.created" no Mercado Pago',
        '2. Testar com bip real de pacote',
        '3. Implementar integração com Google Sheets'
      ]
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Processar notificação
async function processarNotificacao(notificacao) {
  console.log('🔍 Processando notificação...');
  
  let shippingId = null;
  
  if (notificacao.action === 'shipment.created' && notificacao.data) {
    shippingId = notificacao.data.shipment_id;
    console.log('📦 Shipment ID:', shippingId);
  } else if (notificacao.topic === 'shipments' && notificacao.resource) {
    shippingId = notificacao.resource.split('/')[2];
    console.log('📦 Shipment ID ML:', shippingId);
  }
  
  return {
    tipo: notificacao.action || notificacao.topic,
    shipping_id: shippingId,
    processado_em: new Date().toISOString(),
    status: 'recebido'
  };
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
