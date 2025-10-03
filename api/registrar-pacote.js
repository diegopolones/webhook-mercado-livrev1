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
    console.log('=== 📦 REGISTRAR PACOTE - URL SIMPLES ===');
    
    if (req.method === 'POST') {
      const body = await readBody(req);
      const { codigo, plataforma, motoboy, base, destinatario, endereco } = body;
      
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
          headerValues: ['Plataforma', 'Pacote/Código', 'QR-CODE', 'Base', 'Data / Hora', 'Motoboy', 'Endereço', 'Status']
        });
        console.log('✅ Aba criada');
      }

      // 4. Gerar QR Code - URL SIMPLES (SEM fórmulas)
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(codigo)}`;
      console.log('📱 QR Code URL:', qrCodeUrl);
      
      // 5. Preparar dados - URL SIMPLES na coluna QR-CODE
      const novaLinha = {
        'Plataforma': plataforma || 'Mercado Livre',
        'Pacote/Código': codigo,
        'QR-CODE': qrCodeUrl, // ✅ URL SIMPLES (sempre funciona)
        'Base': base || 'Matriz',
        'Data / Hora': new Date().toLocaleString('pt-BR'),
        'Motoboy': motoboy || 'A definir',
        'Endereço': endereco || 'Endereço a confirmar',
        'Status': 'coletado'
      };

      // 6. Salvar na planilha
      await sheet.addRow(novaLinha);
      console.log('✅ Dados salvos com URL do QR Code');

      return res.status(200).json({
        success: true,
        message: '✅ Pacote registrado! URL do QR Code salva na planilha.',
        codigo: codigo,
        qr_code_url: qrCodeUrl,
        instrucoes: 'Copie a URL da coluna QR-CODE e cole no navegador para ver o QR Code',
        planilha: 'https://docs.google.com/spreadsheets/d/1OLsHJyDRl8G9Be_fEvv11LCCmOq5jz2-WqPzTVN0EN8'
      });
    }

    // GET
    return res.status(200).json({
      success: true,
      message: '✅ Sistema de registro - ONLINE'
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
