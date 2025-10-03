const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('=== 📦 REGISTRAR PACOTE - MENUS DINÂMICOS ===');
    
    if (req.method === 'POST') {
      const body = await readBody(req);
      const { codigo, plataforma, endereco } = body;
      
      console.log('📦 Registrando pacote:', codigo);

      // 1. Configurar autenticação Google
      const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      // 2. Conectar com planilha
      const doc = new GoogleSpreadsheet('1OLsHJyDRl8G9Be_fEvv11LCCmOq5jz2-WqPzTVN0EN8', serviceAccountAuth);
      await doc.loadInfo();
      
      // 3. Verificar/Criar aba
      let sheet;
      try {
        sheet = doc.sheetsByTitle['Controle de Coletas'];
        console.log('✅ Aba encontrada');
      } catch {
        sheet = await doc.addSheet({ 
          title: 'Controle de Coletas',
          headerValues: ['Plataforma', 'Pacote/Código', 'QR Code', 'Base', 'Data/Hora', 'Diego Oliveira', 'Endereço', 'Status']
        });
        console.log('✅ Aba criada');
      }

      // 4. Gerar QR Code
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(codigo)}`;
      console.log('📱 QR Code URL:', qrCodeUrl);
      
      // 5. Preparar dados - MENUS EM BRANCO para você selecionar
      const novaLinha = {
        'Plataforma': plataforma || 'Mercado Livre',
        'Pacote/Código': codigo,
        'QR Code': qrCodeUrl, // ✅ URL do QR Code (O MAIS IMPORTANTE)
        'Base': '', // ✅ EM BRANCO - você seleciona no menu suspenso
        'Data/Hora': new Date().toLocaleString('pt-BR'),
        'Diego Oliveira': '', // ✅ EM BRANCO - você seleciona no menu suspenso
        'Endereço': endereco || 'Endereço a confirmar',
        'Status': 'coletado'
      };

      // 6. Salvar na planilha
      await sheet.addRow(novaLinha);
      console.log('✅ Dados salvos - menus em branco para seleção');

      return res.status(200).json({
        success: true,
        message: '✅ Pacote registrado! QR Code salvo. Selecione Base e Motoboy nos menus suspensos.',
        codigo: codigo,
        qr_code_url: qrCodeUrl,
        instrucoes: [
          '1. Copie a URL da coluna "QR Code" para ver o QR Code',
          '2. Selecione a Base correta no menu suspenso',
          '3. Selecione o Motoboy correto no menu suspenso'
        ],
        planilha: 'https://docs.google.com/spreadsheets/d/1OLsHJyDRl8G9Be_fEvv11LCCmOq5jz2-WqPzTVN0EN8'
      });
    }

    // GET - Instruções simplificadas
    return res.status(200).json({
      success: true,
      message: '✅ Sistema de registro - ONLINE',
      instrucoes: {
        metodo: 'POST',
        url: '/api/registrar-pacote',
        body: {
          codigo: 'ML123456789', // ← Código do pacote (OBRIGATÓRIO)
          plataforma: 'Mercado Livre', // ← Plataforma (OPCIONAL)
          endereco: 'Endereço de entrega' // ← Endereço (OPCIONAL)
        },
        observacao: 'Base e Motoboy ficam em branco para você selecionar nos menus suspensos da planilha'
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
