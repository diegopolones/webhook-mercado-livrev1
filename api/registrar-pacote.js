import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export default async function handler(req, res) {
  // Configurar CORS
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
      const { codigo, plataforma, motoboy, base, destinatario, endereco } = body;
      
      console.log('📦 Dados recebidos:', { codigo, plataforma, motoboy, base });

      // 1. Configurar autenticação Google
      const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      console.log('✅ Autenticação Google configurada');

      // 2. Conectar com planilha
      const doc = new GoogleSpreadsheet('1OLsHJyDRl8G9Be_fEvv11LCCmOq5jz2-WqPzTVN0EN8', serviceAccountAuth);
      await doc.loadInfo();
      console.log('✅ Conectado à planilha:', doc.title);
      
      // 3. Verificar/Criar aba
      let sheet;
      try {
        sheet = doc.sheetsByTitle['Controle de Coletas'];
        console.log('✅ Aba "Controle de Coletas" encontrada');
      } catch {
        sheet = await doc.addSheet({ 
          title: 'Controle de Coletas',
          headerValues: ['Plataforma', 'Pacote/Código', 'QR-CODE', 'Base', 'Data / Hora', 'Motoboy', 'Endereço', 'Status']
        });
        console.log('✅ Aba "Controle de Coletas" criada');
      }

      // 4. Gerar QR Code
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(codigo)}`;
      console.log('✅ QR Code gerado:', qrCodeUrl);
      
      // 5. Preparar dados
      const novaLinha = {
        'Plataforma': plataforma || 'Mercado Livre',
        'Pacote/Código': codigo,
        'QR-CODE': `=IMAGE("${qrCodeUrl}")`,
        'Base': base || 'Matriz',
        'Data / Hora': new Date().toLocaleString('pt-BR'),
        'Motoboy': motoboy || 'A definir',
        'Endereço': endereco || 'A definir',
        'Status': 'coletado'
      };

      // 6. Salvar na planilha
      await sheet.addRow(novaLinha);
      
      console.log('✅ Dados salvos na planilha:', codigo);

      return res.status(200).json({
        success: true,
        message: '✅ Pacote registrado com sucesso na planilha!',
        codigo: codigo,
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
          codigo: 'ML123456789',
          plataforma: 'Mercado Livre',
          motoboy: 'João Silva',
          base: 'Matriz',
          destinatario: 'Cliente Exemplo',
          endereco: 'Rua Exemplo, 123'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao registrar pacote:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message,
      detalhes: 'Erro na conexão com Google Sheets'
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
