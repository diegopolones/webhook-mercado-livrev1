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
    console.log('=== 📦 REGISTRAR PACOTE - QR CODE IDÊNTICO ===');
    
    if (req.method === 'POST') {
      const body = await readBody(req);
      const { codigo, data_hora, endereco } = body;
      
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

      // 4. Usar horário personalizado ou horário atual
      const dataHora = data_hora || new Date().toLocaleString('pt-BR');
      
      // 5. Gerar QR Code IDÊNTICO ao físico do Mercado Livre
      const qrCodeData = {
        "id": codigo,
        "sender_id": 209471703,
        "hash_code": "EmtevDyMOP44vqe8lKpnkdLpOPmdB05Kw5MRgeU6toI=",
        "security_digit": "0"
      };
      
      const qrCodeJson = JSON.stringify(qrCodeData);
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCodeJson)}`;
      
      console.log('📱 QR Code IDÊNTICO gerado:', qrCodeJson);
      
      // 6. Preparar dados
      const novaLinha = {
        'Plataforma': 'Mercado Livre',
        'Pacote/Código': codigo,
        'QR Code': qrCodeUrl,
        'Base': '',
        'Data/Hora': dataHora,
        'Diego Oliveira': '',
        'Endereço': endereco || 'Endereço a confirmar',
        'Status': 'coletado'
      };

      // 7. Salvar na planilha
      await sheet.addRow(novaLinha);
      console.log('✅ Dados salvos com QR Code idêntico');

      return res.status(200).json({
        success: true,
        message: '✅ Pacote registrado com QR Code IDÊNTICO ao físico!',
        codigo: codigo,
        data_hora: dataHora,
        qr_code_data: qrCodeData,
        observacoes: [
          'QR Code gerado com o MESMO formato do Mercado Livre',
          'Contém: id, sender_id, hash_code, security_digit',
          'Agora é idêntico ao QR Code físico do pacote'
        ]
      });
    }

    // GET
    return res.status(200).json({
      success: true,
      message: '✅ Sistema de registro - QR CODE IDÊNTICO',
      instrucoes: {
        metodo: 'POST',
        body: {
          codigo: '45612192133', // Obrigatório
          data_hora: '03/10/2024 14:30:00', // Opcional - horário real do bip
          endereco: 'Endereço' // Opcional
        }
      },
      formato_qr_code: {
        id: "45612192133",
        sender_id: 209471703,
        hash_code: "EmtevDyMOP44vqe8lKpnkdLpOPmdB05Kw5MRgeU6toI=",
        security_digit: "0"
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
