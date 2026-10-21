import 'dotenv/config';

async function testWc() {
  const wcUrl = process.env.NEXT_PUBLIC_WC_STORE_URL;
  const consumerKey = process.env.CONSUMER_KEY;
  const consumerSecret = process.env.CONSUMER_SECRET;

  const baseUrl = wcUrl.replace(/\/$/, '');
  const url = new URL(baseUrl + '/wp-json/wc/v3/products');
  url.searchParams.append('search', 'מארז');
  url.searchParams.append('status', 'publish');
  url.searchParams.append('consumer_key', consumerKey);
  url.searchParams.append('consumer_secret', consumerSecret);

  console.log('Fetching', url.toString());
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; ConfettixCRM/1.0)',
        'Accept': 'application/json',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8',
        'Cache-Control': 'no-cache',
      }
    });
    
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response length:', text.length);
    if (text.length > 200) {
      console.log('Response excerpt:', text.substring(0, 200));
    } else {
      console.log('Response:', text);
    }
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

testWc();
