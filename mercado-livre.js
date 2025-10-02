import fetch from 'node-fetch';
import { CONFIG } from './config.js';

export async function gerarAccessToken() {
  try {
    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: CONFIG.ML_CLIENT_ID,
        client_secret: CONFIG.ML_CLIENT_SECRET,
        refresh_token: CONFIG.ML_REFRESH_TOKEN
      })
    });

    const data = await response.json();
    
    if (data.access_token) {
      console.log('✅ Access Token gerado com sucesso');
      return data.access_token;
    } else {
      throw new Error(`Erro ao gerar token: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    console.error('❌ Erro ao gerar access token:', error);
    throw error;
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

    console.log('✅ Dados do shipment obtidos:', shipmentId);
    
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
