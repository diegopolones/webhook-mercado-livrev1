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
    console.log('=== 📦 BUSCAR QR CODE REAL DO ML ===');
    
    if (req.method === 'POST') {
      const body = await readBody(req);
      const { codigo, data_hora } = body;
      
      console.log('🔍 Buscando QR Code real para:', codigo);

      // 1. BUSCAR QR CODE REAL DO MERCADO LIVRE
      let qrCodeUrlReal = '';
      let dadosReais = {};
      
      try {
        console.log('🔄 Conectando com API Mercado Livre...');
        const accessToken = await gerarAccessToken();
        
        // Buscar dados do shipment
        const shipmentData = await buscarShipmentPorCodigo(codigo, accessToken);
        
        if (shipmentData) {
          console.log('✅ Dados reais encontrados:', shipmentData.id);
          dadosReais = {
            destinatario: shipmentData.receiver_address?.receiver_name || 'Não encontrado',
            endereco: extrairEndereco(shipmentData),
            status: shipmentData.status || 'coletado'
          };
          
          // Tentar buscar URL do QR Code real
          qrCodeUrlReal = await buscarQRCodeReal(shipmentData.id, accessToken);
        }
      } catch (error) {
        console.log('⚠️ Não foi possível buscar dados reais:', error.message);
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
          headerValues: ['Plataforma', 'Pacote/Código', 'QR Code', 'Base', 'Data/Hora', 'Diego Oliveira', 'Endereço', 'Status']
        });
      }

      // 5. Usar QR Code real ou placeholder
      const qrCodeFinal = qrCodeUrlReal || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=AGUARDANDO_QR_REAL_${codigo}`;
      
      // 6. Preparar dados
      const novaLinha = {
        'Plataforma': 'Mercado Livre',
        'Pacote/Código': codigo,
        'QR Code': qrCodeFinal,
        'Base': '',
        'Data/Hora': data_hora || new Date().toLocaleString('pt-BR'),
        'Diego Oliveira': '',
        'Endereço': dadosReais.endereco || 'Buscando endereço...',
        'Status': dadosReais.status || 'coletado'
      };

      // 7. Salvar na planilha
      await sheet.addRow(novaLinha);
      
      console.log('✅ Dados salvos - QR Code:', qrCodeUrlReal ? 'REAL' : 'PLACEHOLDER');

      return res.status(200).json({
        success: true,
        message: qrCodeUrlReal 
          ? '✅ QR Code REAL do Mercado Livre salvo!' 
          : '✅ Pacote registrado (QR Code placeholder)',
        codigo: codigo,
        qr_code_real: !!qrCodeUrlReal,
        dados_reais: !!dadosReais.endereco,
        observacoes: qrCodeUrlReal 
          ? ['QR Code REAL do pacote físico', 'Dados reais do destinatário'] 
          : ['QR Code temporário', 'Sem acesso à API de QR codes do ML']
      });
    }

    // GET
    return res.status(200).json({
      success: true,
      message: '✅ Sistema de busca de QR Code REAL',
      instrucoes: {
        metodo: 'POST',
        body: {
          codigo: '45612192133' // Código do pacote ML
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
}

// Buscar QR Code real do Mercado Livre
async function buscarQRCodeReal(shipmentId, accessToken) {
  try {
    console.log(`📦 Buscando QR Code real para shipment: ${shipmentId}`);
    
    // Tentar diferentes endpoints para QR Code
    const endpoints = [
      `https://api.mercadolibre.com/shipments/${shipmentId}/labels`,
      `https://api.mercadolibre.com/shipments/${shipmentId}/shipping_labels`,
      `https://api.mercadolibre.com/shipments/${shipmentId}/print`
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ QR Code encontrado no endpoint:', endpoint);
          
          // Extrair URL do QR Code da resposta
          if (data.label_url || data.url || data.qr_code) {
            return data.label_url || data.url || data.qr_code;
          }
        }
      } catch (error) {
        console.log(`❌ Endpoint ${endpoint} falhou:`, error.message);
      }
    }
    
    throw new Error('QR Code real não encontrado na API');
    
  } catch (error) {
    console.error('❌ Erro ao buscar QR Code real:', error.message);
    throw error;
  }
}

// Buscar shipment por código
async function buscarShipmentPorCodigo(codigo, accessToken) {
  try {
    // Tentar buscar por tracking number
    const response = await fetch(`https://api.mercadolibre.com/shipments/search?tracking_number=${codigo}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      return data.results[0];
    }
    
    throw new Error('Shipment não encontrado');
    
  } catch (error) {
    console.error('❌ Erro ao buscar shipment:', error.message);
    throw error;
  }
}

// Funções auxiliares (manter as existentes)
async function gerarAccessToken() {
  // ... manter função existente ...
}

function extrairEndereco(shipmentData) {
  // ... manter função existente ...
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
