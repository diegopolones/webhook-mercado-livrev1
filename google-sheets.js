import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { CONFIG } from './config.js';
import { gerarQRCode } from './qr-code.js';

export async function salvarNoGoogleSheets(shipmentData) {
  try {
    console.log('📊 Iniciando salvamento no Google Sheets...');
    
    // Configurar autenticação (você vai preencher depois)
    const serviceAccountAuth = new JWT({
      email: CONFIG.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: CONFIG.GOOGLE_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(CONFIG.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    
    // Usar a aba "Controle de Coletas"
    let sheet;
    try {
      sheet = doc.sheetsByTitle['Controle de Coletas'];
    } catch {
      // Se a aba não existir, criar
      sheet = await doc.addSheet({ 
        title: 'Controle de Coletas',
        headerValues: [
          'Plataforma', 'Pacote/Código', 'QR-CODE', 'Base', 
          'Data / Hora', 'Motoboy', 'Endereço', 'Status'
        ]
      });
    }

    // Gerar QR Code
    const qrCodeUrl = await gerarQRCode(shipmentData.codigo_rastreio);
    
    // Preparar dados para a linha
    const novaLinha = {
      'Plataforma': shipmentData.plataforma,
      'Pacote/Código': shipmentData.codigo_rastreio,
      'QR-CODE': `=IMAGE("${qrCodeUrl}")`,
      'Base': 'Matriz', // Puxar do cadastro depois
      'Data / Hora': new Date().toLocaleString('pt-BR'),
      'Motoboy': 'A definir', // Puxar do cadastro depois
      'Endereço': shipmentData.endereco,
      'Status': shipmentData.status
    };

    // Adicionar linha
    await sheet.addRow(novaLinha);
    
    console.log('✅ Dados salvos no Google Sheets:', shipmentData.codigo_rastreio);
    
    return {
      success: true,
      codigo_rastreio: shipmentData.codigo_rastreio,
      linha_adicionada: true
    };
    
  } catch (error) {
    console.error('❌ Erro ao salvar no Google Sheets:', error);
    throw error;
  }
}
