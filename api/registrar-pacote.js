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
    console.log('=== 📦 REGISTRAR PACOTE COM DADOS REAIS ===');
    
    if (req.method === 'POST') {
      const body = await readBody(req);
      const { codigo, plataforma, motoboy, base } = body;
      
      console.log('📦 Dados recebidos:', { codigo, plataforma, motoboy, base });

      // 1. BUSCAR DADOS REAIS DO MERCADO LIVRE
      let dadosReais = {
        destinatario: 'Buscando dados...',
        endereco: 'Buscando dados...',
        status: 'coletado'
      };

      try {
        console.log('🔍 Buscando dados reais do pacote:', codigo);
        
        // Buscar dados básicos - vamos tentar uma abordagem simples
        const accessToken = await gerarAccessToken();
        dadosReais = await buscarDadosSimples(codigo, accessToken);
        console.log('✅ Dados reais encontrados:', dadosReais);
      } catch (error) {
        console.log('⚠️ Usando dados manuais:', error.message);
        // Mantém dados manuais se não conseguir buscar
      }

      // 2. Configurar autenticação Google
      const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      // 3. Conectar com planilha
      const doc = new GoogleSpreadsheet('1OLsHJyDRl8G9Be_fEvv11LCCmOq5jz2-WqPzTVN0EN8', serviceAccountAuth);
      await doc.loadInfo();
      
      // 4. Verificar/Criar aba
      let sheet;
      try {
        sheet = doc.sheetsByTitle['Controle de Coletas'];
      } catch {
        sheet = await doc.addSheet({ 
          title: 'Controle de Coletas',
          headerValues: ['Plataforma', 'Pacote/Código', 'QR-CODE', 'Base', 'Data / Hora', 'Motoboy', 'Endereço', 'Status']
        });
      }

      // 5. Gerar QR Code
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(codigo)}`;
      
      // 6. Preparar dados COM INFORMAÇÕES REAIS
      const novaLinha = {
        'Plataforma': plataforma || 'Mercado Livre',
        'Pacote/Código': codigo,
        'QR-CODE': `=IMAGE("${qrCodeUrl}")`,
        'Base': base || 'Matriz',
        'Data / Hora': new Date().toLocaleString('pt-BR'),
        'Motoboy': motoboy || 'A definir',
        'Endereço': dadosReais.endereco,
        'Status': dadosReais.status
      };

      // 7. Salvar na planilha
      await sheet.addRow(novaLinha);
      
      console.log('✅ Dados salvos na planilha:', codigo);

      return res.status(200).json({
        success: true,
        message: dadosReais.destinatario !== 'Buscando dados...' 
          ? '✅ Pacote registrado com dados reais!' 
          : '✅ Pacote registrado (dados limitados)',
        codigo: codigo,
        dados_reais: dadosReais.destinatario !== 'Buscando dados...',
        planilha: 'https://docs.google.com/spreadsheets/d/1OLsHJyDRl8G9Be_fEvv11LCCmOq5jz2-WqPzTVN0EN8'
      });
    }

    // GET
    return res.status(200).json({
      success: true,
      message: '✅ API para registrar pacotes - ONLINE'
    });
    
  } catch (error) {
    console.error('❌ Erro ao registrar pacote:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
}

// Função para buscar dados simples do Mercado Livre
async function buscarDadosSimples(codigoRastreio, accessToken) {
  try {
    console.log(`🔍 Buscando dados para: ${codigoRastreio}`);
    
    // Tentar buscar shipment por tracking number
    const response = await fetch(`https://api.mercadolibre.com/shipments/search?tracking_number=${codigoRastreio}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Erro API: ${data.message}`);
    }

    if (data.results && data.results.length > 0) {
      const shipment = data.results[0];
      
      // Buscar detalhes completos
      const detailResponse = await fetch(`https://api.mercadolibre.com/shipments/${shipment.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const detailData = await detailResponse.json();
      
      return {
        destinatario: detailData.receiver_address?.receiver_name || 'Não encontrado',
        endereco: extrairEndereco(detailData),
        status: detailData.status || 'coletado'
      };
    }
    
    throw new Error('Pacote não encontrado');
    
  } catch (error) {
    console.error('❌ Erro na busca:', error.message);
    throw error;
  }
}

// Função para extrair endereço
function extrairEndereco(shipmentData) {
  if (shipmentData.receiver_address) {
    const addr = shipmentData.receiver_address;
    return `${addr.address_line || ''}, ${addr.street_name || ''} ${addr.street_number || ''} - ${addr.city?.name || ''}, ${addr.state?.name || ''}`.trim();
  }
  return 'Endereço não informado';
}

// Função para gerar access token
async function gerarAccessToken() {
  try {
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
  } catch (error) {
    console.error('❌ Erro ao gerar access token:', error);
    throw error;
  }
}

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
