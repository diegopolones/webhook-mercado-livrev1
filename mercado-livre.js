import fetch from 'node-fetch';
import { CONFIG } from './config.js';

export async function gerarAccessToken() {
  try {
    console.log('🔄 Tentando autenticar com Mercado Livre...');
    
    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'grant_type': 'client_credentials',
        'client_id': CONFIG.ML_CLIENT_ID,
        'client_secret': CONFIG.ML_CLIENT_SECRET
      })
    });

    const data = await response.json();
    
    if (data.access_token) {
      console.log('✅ Access Token Mercado Livre gerado');
      return data.access_token;
    } else {
      console.log('❌ Erro na autenticação:', data);
      throw new Error(`Falha na autenticação: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    console.error('❌ Erro crítico na autenticação:', error);
    throw error;
  }
}

export async function buscarEnviosRecentes(accessToken) {
  try {
    console.log('📦 Buscando envios recentes...');
    
    // Tentar diferentes endpoints da API
    const endpoints = [
      `https://api.mercadolibre.com/users/${CONFIG.ML_USER_ID}/shipments/search?sort=date_created_desc&limit=10`,
      `https://api.mercadolibre.com/shipments/search?user_id=${CONFIG.ML_USER_ID}&sort=date_created_desc&limit=10`,
      `https://api.mercadolibre.com/users/${CONFIG.ML_USER_ID}/shipping_options?access_token=${accessToken}`
    ];

    let envios = [];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Tentando endpoint: ${endpoint.split('?')[0]}`);
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        const data = await response.json();
        
        if (data.error) {
          console.log(`⚠️ Endpoint não funcionou: ${data.message}`);
          continue;
        }

        if (data.shipments || data.results) {
          envios = data.shipments || data.results || [];
          console.log(`✅ Encontrados ${envios.length} envios no endpoint: ${endpoint.split('?')[0]}`);
          break;
        }
      } catch (error) {
        console.log(`⚠️ Erro no endpoint ${endpoint.split('?')[0]}: ${error.message}`);
      }
    }

    return envios;
    
  } catch (error) {
    console.error('❌ Erro ao buscar envios:', error);
    return [];
  }
}

export async function buscarDadosShipment(shipmentId, accessToken) {
  try {
    console.log(`📦 Buscando dados do shipment: ${shipmentId}`);
    
    const response = await fetch(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const shipmentData = await response.json();
    
    if (shipmentData.error) {
      throw new Error(`Erro na API: ${shipmentData.message}`);
    }

    console.log('✅ Dados do shipment obtidos');
    
    // Extrair informações relevantes
    return {
      plataforma: 'Mercado Livre',
      codigo_rastreio: shipmentData.tracking_number || shipmentId,
      shipping_id: shipmentId,
      destinatario: extrairDestinatario(shipmentData),
      endereco: extrairEndereco(shipmentData),
      status: shipmentData.status || 'coletado',
      data_criacao: shipmentData.date_created,
      valor: shipmentData.cost || '',
      observacoes: shipmentData.comments || ''
    };
    
  } catch (error) {
    console.error('❌ Erro ao buscar dados do shipment:', error);
    throw error;
  }
}

function extrairDestinatario(shipmentData) {
  if (shipmentData.receiver_address && shipmentData.receiver_address.receiver_name) {
    return shipmentData.receiver_address.receiver_name;
  }
  return 'Destinatário não informado';
}

function extrairEndereco(shipmentData) {
  if (shipmentData.receiver_address) {
    const addr = shipmentData.receiver_address;
    return `${addr.address_line || ''}, ${addr.street_name || ''} ${addr.street_number || ''} - ${addr.city?.name || ''}, ${addr.state?.name || ''}`.trim();
  }
  return 'Endereço não informado';
}
