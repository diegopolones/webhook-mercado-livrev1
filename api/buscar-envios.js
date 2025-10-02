import { CONFIG } from '../config.js';
import { gerarAccessToken, buscarEnviosRecentes, buscarDadosShipment } from '../mercado-livre.js';
import { salvarNoGoogleSheets } from '../google-sheets.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('=== 🔍 BUSCA ATIVA DE ENVIOS ===');
    
    // Gerar access token
    const accessToken = await gerarAccessToken();
    
    // Buscar envios recentes
    const envios = await buscarEnviosRecentes(accessToken);
    
    console.log(`📦 Total de envios encontrados: ${envios.length}`);
    
    // Processar cada envio
    const resultados = [];
    for (const envio of envios.slice(0, 5)) { // Limitar a 5 para teste
      try {
        console.log(`🔄 Processando envio: ${envio.id}`);
        
        // Buscar dados completos
        const shipmentData = await buscarDadosShipment(envio.id, accessToken);
        
        // Salvar no Google Sheets
        const sheetResult = await salvarNoGoogleSheets(shipmentData);
        
        resultados.push({
          shipment_id: envio.id,
          status: 'sucesso',
          codigo_rastreio: shipmentData.codigo_rastreio,
          salvo_na_planilha: true
        });
        
        // Pequena pausa para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Erro no envio ${envio.id}:`, error.message);
        resultados.push({
          shipment_id: envio.id,
          status: 'erro',
          erro: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      total_encontrados: envios.length,
      processados: resultados.length,
      resultados: resultados,
      mensagem: resultados.length > 0 ? 'Dados salvos na planilha!' : 'Nenhum envio recente encontrado'
    });

  } catch (error) {
    console.error('❌ Erro na busca ativa:', error);
    res.status(500).json({ 
      error: error.message,
      detalhes: 'Verifique as credenciais do Mercado Livre'
    });
  }
}
