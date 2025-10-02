import { CONFIG } from '../config.js';
import { gerarAccessToken, buscarDadosShipment } from '../mercado-livre.js';
import { salvarNoGoogleSheets } from '../google-sheets.js';

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
      console.log('📦 Notificação:', JSON.stringify(body, null, 2));
      
      // Processar notificação
      const resultado = await processarNotificacao(body);
      
      return res.status(200).json({ 
        status: 'OK', 
        message: 'Notificação processada com sucesso',
        timestamp: new Date().toISOString(),
        processado: resultado
      });
    }
    
    // Resposta para GET - Status do webhook
    return res.status(200).json({ 
      status: 'ONLINE', 
      message: 'Webhook Mercado Livre - Pronto para produção',
      webhook_url: CONFIG.WEBHOOK_URL,
      next_steps: [
        '✅ Webhook configurado e testado',
        '🔄 Implementar autenticação Mercado Livre',
        '📦 Buscar dados completos dos shipments',
        '📊 Integrar com Google Sheets'
      ]
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Processar notificação COMPLETA
async function processarNotificacao(notificacao) {
  console.log('🔍 Processando notificação...');
  
  let shippingId = null;
  
  // Identificar o shipping_id baseado no tipo de notificação
  if (notificacao.action === 'shipment.created' && notificacao.data) {
    shippingId = notificacao.data.shipment_id;
  } else if (notificacao.topic === 'shipments' && notificacao.resource) {
    shippingId = notificacao.resource.split('/')[2];
  } else if (notificacao.action === 'test.created') {
    console.log('✅ Webhook testado com sucesso!');
    return { tipo: 'test', status: 'webhook_funcionando' };
  }
  
  if (shippingId) {
    console.log('📦 Shipment ID encontrado:', shippingId);
    
    // 🔑 PASSO 1: Gerar access token
    const accessToken = await gerarAccessToken();
    
    // 📦 PASSO 2: Buscar dados completos do shipment
    const shipmentData = await buscarDadosShipment(shippingId, accessToken);
    
    // 📊 PASSO 3: Salvar no Google Sheets
    const sheetResult = await salvarNoGoogleSheets(shipmentData);
    
    return {
      tipo: notificacao.action || notificacao.topic,
      shipping_id: shippingId,
      shipment_data: shipmentData,
      sheet_result: sheetResult,
      processado_em: new Date().toISOString(),
      status: 'dados_salvos'
    };
  }
  
  return {
    tipo: notificacao.action || notificacao.topic,
    processado_em: new Date().toISOString(),
    status: 'sem_shipping_id'
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
