import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { gerarAccessToken, buscarDadosPorCodigo } from '../mercado-livre.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('=== 📦 REGISTRAR PACOTE - INICIADO ===');
    
    if (req.method === 'POST') {
      const body = await readBody(req);
      const { codigo, plataforma, motoboy, base } = body;
      
      console.log('📦 Dados recebidos:', { codigo, plataforma, motoboy, base });

      // 1. BUSCAR DADOS REAIS DO MERCADO LIVRE
      let dadosReais = {
        plataforma: plataforma || 'Mercado Livre',
        codigo_rastreio: codigo,
        destinatario: 'Buscando...',
        endereco: 'Buscando...',
        status: 'coletado'
      };

      try {
        console.log('🔍 Buscando dados reais do pacote:', codigo);
        const accessToken = await gerarAccessToken();
        dadosReais = await buscarDadosPorCodigo(codigo, accessToken);
        console.log('✅ Dados reais encontrados:', dadosReais);
      } catch (error) {
        console.log('⚠️ Não foi possível buscar dados reais, usando dados manuais:', error.message);
        // Mantém os dados manuais se não conseguir buscar
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
      
      // 6. Preparar dados COMPLETOS
      const novaLinha = {
        'Plataforma': dadosReais.plataforma,
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
      
      console.log('✅ Dados reais salvos na planilha:', codigo);

      return res.status(200).json({
        success: true,
        message: '✅ Pacote registrado com dados reais na planilha!',
        codigo: codigo,
        dados_reais: dadosReais.destinatario !== 'Buscando...',
        planilha: 'https://docs.google.com/spreadsheets/d/1OLsHJyDRl8G9Be_fEvv11LCCmOq5jz2-WqPzTVN0EN8'
      });
    }

    // GET - Mostrar que está funcionando
    return res.status(200).json({
      success: true,
      message: '✅ API para registrar pacotes - ONLINE',
      instrucoes: {
        metodo: 'POST',
        url: '/api/registrar-pacote',
        body: {
          codigo: 'ML123456789',  // Código REAL do pacote
          plataforma: 'Mercado Livre',
          motoboy: 'João Silva',
          base: 'Matriz'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao registrar pacote:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
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
