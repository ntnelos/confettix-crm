import https from 'https';
import 'dotenv/config';

const wcUrl = process.env.NEXT_PUBLIC_WC_STORE_URL;
const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;

const baseUrl = wcUrl.replace(/\/$/, '');
const url = new URL(baseUrl + '/wp-json/wc/v3/products');
url.searchParams.append('search', 'מארז');
url.searchParams.append('status', 'publish');
url.searchParams.append('consumer_key', consumerKey);
url.searchParams.append('consumer_secret', consumerSecret);

https.get(url, {
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; ConfettixCRM/1.0)',
    'Accept': 'application/json',
    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8',
    'Cache-Control': 'no-cache',
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response length:', data.length);
  });
}).on('error', (e) => {
  console.error(e);
});
