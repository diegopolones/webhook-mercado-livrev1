import fetch from 'node-fetch';

export async function gerarQRCode(codigoRastreio) {
  try {
    // Usar API pública para gerar QR Code
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(codigoRastreio)}`;
    
    console.log('📱 QR Code gerado para:', codigoRastreio);
    return qrCodeUrl;
    
  } catch (error) {
    console.error('❌ Erro ao gerar QR Code:', error);
    // Retorna URL fallback
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=ERRO`;
  }
}
