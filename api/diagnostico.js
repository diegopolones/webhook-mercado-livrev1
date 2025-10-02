import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('=== 🔍 DIAGNÓSTICO INICIADO ===');
    
    // 1. Testar autenticação Google
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    console.log('✅ Autenticação Google configurada');
    
    // 2. Testar conexão com planilha
    const doc = new GoogleSpreadsheet('1OLsHJyDRl8G9Be_fEvv11LCCmOq5jz2-WqPzTVN0EN8', serviceAccountAuth);
    await doc.loadInfo();
    
    console.log('✅ Conexão com planilha OK:', doc.title);
    
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

    // 4. Testar escrita
    const testRow = {
      'Plataforma': 'TESTE DIAGNÓSTICO',
      'Pacote/Código': 'DIAG123',
      'QR-CODE': '=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=DIAG123")',
      'Base': 'Matriz',
      'Data / Hora': new Date().toLocaleString('pt-BR'),
      'Motoboy': 'SISTEMA',
      'Endereço': 'Teste de diagnóstico',
      'Status': 'teste'
    };

    await sheet.addRow(testRow);
    console.log('✅ Dados de teste salvos na planilha');

    res.status(200).json({
      success: true,
      message: 'Diagnóstico completo - sistema funcionando',
      testes: [
        '✅ Autenticação Google',
        '✅ Conexão com planilha', 
        '✅ Aba Controle de Coletas',
        '✅ Escrita de dados',
        '✅ QR Code configurado'
      ],
      planilha: 'https://docs.google.com/spreadsheets/d/1OLsHJyDRl8G9Be_fEvv11LCCmOq5jz2-WqPzTVN0EN8'
    });

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      etapa_falha: 'Verificar credenciais Google Sheets'
    });
  }
}
