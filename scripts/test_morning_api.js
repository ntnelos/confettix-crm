const fetch = require('node-fetch');

async function testMorning() {
  const apiKey = '09493b10-4fe8-4aaa-bf20-71811c905c95';
  const apiSecret = 'wPW)-j2Nb(b"IWqNq7VSbmDhI3XzKcV(';
  const apiUrl = 'https://sandbox.d.greeninvoice.co.il/api/v1';

  let authRes = await fetch(`${apiUrl}/account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: apiKey, secret: apiSecret })
  });
  
  if (!authRes.ok) {
    console.error('Auth error', await authRes.text());
    return;
  }
  
  const tokenData = await authRes.json();
  const token = tokenData.token;
  
  const docPayload = {
    type: 305,
    client: {
      name: "Test Client API", // You can pass name instead of ID for temporary clients, or ID if exists. Let's just create a client or use name.
      add: true
    },
    currency: 'ILS',
    lang: 'he',
    income: [{
      description: "Test Item",
      quantity: 1,
      price: 100
    }],
    description: "API Test Doc"
  };

  const docRes = await fetch(`${apiUrl}/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(docPayload)
  });
  
  const docData = await docRes.json();
  console.log(JSON.stringify(docData, null, 2));
}

testMorning();
