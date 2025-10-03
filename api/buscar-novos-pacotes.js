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
    console.log('=== 🔍 BUSCA AUTOMÁTICA DE PACOTES ===');
    
    // 1. Gerar access token
    const accessToken = await gerarAccessToken();
    console.log('✅ Access Token gerado');
    
    // 2. Buscar pacotes recentes (últimas 4 horas)
    const quatroHorasAtras = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    console.log('🔍 Buscando pacotes desde:', quatroHorasAtras);
    
    const response = await fetch(`https://api.mercadolibre.com/shipments/search?date_created.from=${quatroHorasAtras}&sort=date_created_desc&limit=30`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`API Error: ${data.message}`);
    }
    
    console.log(`📦 Encontrados ${data.results?.length || 0} pacotes recentes`);
    
    if (!data.results || data.results.length === 0) {
      return res.status(200).json({
        success: true,
        message: '✅ Busca concluída - Nenhum pacote recente encontrado',
        total_encontrados: 0,
        processados: 0
      });
    }
    
    // 3. Processar cada pacote
    const resultados = [];
    for (const shipment of data.results) {
      try {
        console.log(`🔄 Processando: ${shipment.id}`);
        const resultado = await processarPacoteAutomatico(shipment, accessToken);
        resultados.push(resultado);
        
        // Pequena pausa para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (error) {
        console.error(`❌ Erro no pacote ${shipment.id}:`, error.message);
        resultados.push({
          shipment_id: shipment.id,
          success: false,
          error: error.message
        });
      }
    }
    
    const sucessos = resultados.filter(r => r.success).length;
    const erros = resultados.filter(r => !r.success).length;
    
    console.log(`✅ Busca concluída: ${sucessos} sucessos, ${erros} erros`);
    
    res.status(200).json({
      success: true,
      message: `✅ Busca automática concluída!`,
      total_encontrados: data.results.length,
      processados: sucessos,
      com_erro: erros,
      resultados: resultados.slice(0, 10) // Mostrar apenas os primeiros 10
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
async function processarPacoteAutomatico(shipment, accessToken) {
  try {
    // 1. Buscar dados completos
    const shipmentResponse = await fetch(`https://api.mercadolibre.com/shipments/${shipment.id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const shipmentData = await shipmentResponse.json();
    
    if (shipmentData.error) {
      throw new Error(shipmentData.message);
    }
    
    // 2. Extrair dados reais
    const dadosReais = {
      codigo: shipmentData.tracking_number || shipment.id,
      plataforma: 'Mercado Livre',
      destinatario: shipmentData.receiver_address?.receiver_name || 'Não informado',
      endereco: extrairEndereco(shipmentData),
      status: shipmentData.status || 'coletado',
      data_criacao: shipmentData.date_created ? 
        new Date(shipmentData.date_created).toLocaleString('pt-BR') : 
        new Date().toLocaleString('pt-BR')
    };
    
    console.log(`📍 ${dadosReais.codigo}: ${dadosReais.destinatario}`);
    
    // 3. Gerar QR Code
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(dadosReais.codigo)}`;
    
    // 4. Salvar na planilha
    await salvarNaPlanilha(dadosReais, qrCodeUrl);
    
    console.log(`✅ ${dadosReais.codigo} salvo automaticamente`);
    
    return {
      shipment_id: shipment.id,
      codigo: dadosReais.codigo,
      success: true,
      destinatario: dadosReais.destinatario,
      endereco: dadosReais.endereco,
      status: dadosReais.status
    };
    
  } catch (error) {
    console.error(`❌ Erro ao processar ${shipment.id}:`, error.message);
    throw error;
  }
}

// Extrair endereço
function extrairEndereco(shipmentData) {
  if (shipmentData.receiver_address) {
    const addr = shipmentData.receiver_address;
    const endereco = `${addr.address_line || ''} ${addr.street_name || ''} ${addr.street_number || ''}`.trim();
    const cidade = `${addr.city?.name || ''} - ${addr.state?.name || ''}`.trim();
    
    return `${endereco}, ${cidade}`.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
  }
  return 'Endereço não informado';
}

// Salvar na planilha
async function salvarNaPlanilha(dados, qrCodeUrl) {
  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet('1OLsHJyDRl8G9Be_fEvv11LCCmOq5jz2-WqPzTVN0EN8', serviceAccountAuth);
  await doc.loadInfo();
  
  let sheet;
  try {
    sheet = doc.sheetsByTitle['Controle de Coletas'];
  } catch {
    sheet = await doc.addSheet({ 
      title: 'Controle de Coletas',
      headerValues: ['Plataforma', 'Pacote/Código', 'QR Code', 'Base', 'Data/Hora', 'Diego Oliveira', 'Endereço', 'Status']
    });
  }

  const novaLinha = {
    'Plataforma': dados.plataforma,
    'Pacote/Código': dados.codigo,
    'QR Code': qrCodeUrl,
    'Base': '',
    'Data/Hora': dados.data_criacao,
    'Diego Oliveira': '',
    'Endereço': dados.endereco,
    'Status': dados.status
  };

  await sheet.addRow(novaLinha);
}

// Gerar access token
async function gerarAccessToken() {
  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'grant_type': 'client_credentials',
      'client_id': process.env.ML_CLIENT_ID || '4660475068392971',
      'client_secret': process.env.ML_CLIENT_SECRET || 'QsMuIGHGJn2PCazOJmgH7DLFbRXapSe0'
    })
  });

  const data = await response.json();
  
  if (data.access_token) {
    return data.access_token;
  } else {
    throw new Error(`Falha na autenticação: ${JSON.stringify(data)}`);
  }
}
