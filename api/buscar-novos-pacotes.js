const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('=== 🔍 BUSCA AUTOMÁTICA DE NOVOS PACOTES ===');
    
    // 1. Gerar access token
    const accessToken = await gerarAccessToken();
    
    // 2. Buscar pacotes recentes (últimas 2 horas)
    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const response = await fetch(`https://api.mercadolibre.com/shipments/search?date_created.from=${duasHorasAtras}&sort=date_created_desc&limit=50`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const data = await response.json();
    console.log(`📦 Encontrados ${data.results?.length || 0} pacotes recentes`);
    
    // 3. Processar cada pacote
    const resultados = [];
    for (const shipment of data.results || []) {
      try {
        const resultado = await processarPacoteAutomatico(shipment.id, accessToken);
        resultados.push(resultado);
        
        // Pequena pausa para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Erro no pacote ${shipment.id}:`, error.message);
        resultados.push({
          shipment_id: shipment.id,
          success: false,
          error: error.message
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Busca automática concluída!',
      total_encontrados: data.results?.length || 0,
      processados: resultados.filter(r => r.success).length,
      com_erro: resultados.filter(r => !r.success).length,
      resultados: resultados
    });
    
  } catch (error) {
    console.error('❌ Erro na busca automática:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
}

// Processar pacote automaticamente
async function processarPacoteAutomatico(shipmentId, accessToken) {
  try {
    console.log(`🔄 Processando pacote: ${shipmentId}`);
    
    // 1. Buscar dados completos do shipment
    const shipmentResponse = await fetch(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const shipmentData = await shipmentResponse.json();
    
    if (shipmentData.error) {
      throw new Error(shipmentData.message);
    }
    
    // 2. Extrair dados reais
    const dadosReais = {
      codigo: shipmentData.tracking_number || shipmentId,
      plataforma: 'Mercado Livre',
      destinatario: shipmentData.receiver_address?.receiver_name || 'Não informado',
      endereco: extrairEndereco(shipmentData),
      status: shipmentData.status || 'coletado',
      data_criacao: shipmentData.date_created ? 
        new Date(shipmentData.date_created).toLocaleString('pt-BR') : 
        new Date().toLocaleString('pt-BR')
    };
    
    console.log(`📍 Dados reais: ${dadosReais.destinatario} - ${dadosReais.endereco}`);
    
    // 3. Buscar QR Code real (se disponível)
    let qrCodeUrl = '';
    try {
      qrCodeUrl = await buscarQRCodeReal(shipmentId, accessToken);
    } catch (error) {
      console.log('⚠️ QR Code real não disponível, usando placeholder');
      qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=ML-${dadosReais.codigo}`;
    }
    
    // 4. Verificar se já existe na planilha
    const jaExiste = await verificarSeExisteNaPlanilha(dadosReais.codigo);
    
    if (jaExiste) {
      console.log(`⏭️ Pacote ${dadosReais.codigo} já existe, pulando...`);
      return {
        shipment_id: shipmentId,
        codigo: dadosReais.codigo,
        success: true,
        acao: 'já_existia',
        destinatario: dadosReais.destinatario
      };
    }
    
    // 5. Salvar na planilha (NOVO registro)
    await salvarNaPlanilha(dadosReais, qrCodeUrl);
    
    console.log(`✅ NOVO pacote ${dadosReais.codigo} salvo automaticamente`);
    
    return {
      shipment_id: shipmentId,
      codigo: dadosReais.codigo,
      success: true,
      acao: 'adicionado',
      destinatario: dadosReais.destinatario,
      endereco: dadosReais.endereco,
      qr_code: !!qrCodeUrl
    };
    
  } catch (error) {
    console.error(`❌ Erro ao processar ${shipmentId}:`, error.message);
    throw error;
  }
}

// Funções auxiliares (manter as existentes)
async function gerarAccessToken() {
  // ... implementação existente ...
}

async function buscarQRCodeReal(shipmentId, accessToken) {
  // ... implementação existente ...
}

function extrairEndereco(shipmentData) {
  // ... implementação existente ...
}

async function verificarSeExisteNaPlanilha(codigo) {
  // ... verificar se código já existe na planilha ...
}

async function salvarNaPlanilha(dados, qrCodeUrl) {
  // ... implementação para salvar na planilha ...
}
