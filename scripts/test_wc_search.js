import 'dotenv/config';

async function testWc() {
  const wcUrl = process.env.NEXT_PUBLIC_WC_STORE_URL;
  const consumerKey = process.env.CONSUMER_KEY;
  const consumerSecret = process.env.CONSUMER_SECRET;

  const baseUrl = wcUrl.replace(/\/$/, '');
  const url = new URL(`${baseUrl}/wp-json/wc/v3/products`);
  url.searchParams.append('status', 'publish');
  url.searchParams.append('per_page', '10');
  url.searchParams.append('consumer_key', consumerKey);
  url.searchParams.append('consumer_secret', consumerSecret);

  console.log('Fetching', url.toString());

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; ConfettixCRM/1.0)',
        'Accept': 'application/json'
      }
    });

    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response length:', text.length);
    console.log('Response excerpt:', text.substring(0, 100));
  } catch(e) {
    console.error(e);
  }
}

testWc();
