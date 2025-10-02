import { CONFIG } from '../config.js';
import { gerarAccessToken, buscarDadosShipment } from '../mercado-livre.js';
import { salvarNoGoogleSheets } from '../google-sheets.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('=== 🔍 BUSCA ATIVA DE SHIPMENTS ===');
    
    // Gerar access token
    const accessToken = await gerarAccessToken();
    
    // Buscar shipments recentes (últimas 2 horas)
    const shipments = await buscarShipmentsRecentes(accessToken);
    
    console.log(`📦 Encontrados ${shipments.length} shipments recentes`);
    
    // Processar cada shipment
    const resultados = [];
    for (const shipment of shipments) {
      try {
        // Buscar dados completos
        const shipmentData = await buscarDadosShipment(shipment.id, accessToken);
        
        // Salvar no Google Sheets
        const sheetResult = await salvarNoGoogleSheets(shipmentData);
        
        resultados.push({
          shipment_id: shipment.id,
          status: 'sucesso',
          codigo_rastreio: shipmentData.codigo_rastreio
        });
        
        // Pequena pausa para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Erro no shipment ${shipment.id}:`, error.message);
        resultados.push({
          shipment_id: shipment.id,
          status: 'erro',
          erro: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      period: 'últimas 2 horas',
      encontrados: shipments.length,
      processados: resultados.length,
      resultados: resultados
    });

  } catch (error) {
    console.error('❌ Erro na busca ativa:', error);
    res.status(500).json({ error: error.message });
  }
}

// Buscar shipments criados nas últimas 2 horas
async function buscarShipmentsRecentes(accessToken) {
  const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  try {
    const response = await fetch(
      `https://api.mercadolibre.com/shipments/search?user_id=${CONFIG.ML_USER_ID}&date_created.from=${duasHorasAtras}&sort=date_created_desc`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`API Error: ${data.message}`);
    }
    
    return data.results || [];
    
  } catch (error) {
    console.error('❌ Erro ao buscar shipments:', error);
    return [];
  }
}
