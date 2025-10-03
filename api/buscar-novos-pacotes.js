const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('=== 🔍 BUSCA AUTOMÁTICA - TESTE ===');
    
    // Teste simples primeiro
    const accessToken = await gerarAccessToken();
    console.log('✅ Access Token OK');
    
    return res.status(200).json({
      success: true,
      message: '✅ Busca automática - SISTEMA ONLINE',
      teste: 'Endpoint funcionando corretamente',
      proximo_passo: 'Implementar busca de pacotes'
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
}

async function gerarAccessToken() {
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
}
