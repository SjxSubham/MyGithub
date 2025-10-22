import https from 'https';
import http from 'http';

/**
 * Utility function to ping a server to keep it alive
 * @param {string} url - The URL to ping
 * @returns {Promise<boolean>} - Returns true if ping was successful
 */
export const pingServer = (url) => {
  return new Promise((resolve, reject) => {
    const httpModule = url.startsWith('https') ? https : http;

    const req = httpModule.get(url, (res) => {
      let data = '';

      // A chunk of data has been received
      res.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Ping successful: ${res.statusCode}`);
          try {
            const parsed = JSON.parse(data);
            console.log(`   Response: ${parsed.status}, Time: ${parsed.timestamp}`);
          } catch (e) {
            // Not JSON or couldn't parse
            console.log(`   Response received (non-JSON)`);
          }
          resolve(true);
        } else {
          console.error(`❌ Ping failed with status: ${res.statusCode}`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Ping error: ${error.message}`);
      reject(error);
    });

    // Set a timeout of 10 seconds
    req.setTimeout(10000, () => {
      req.destroy();
      console.error(`❌ Ping timed out after 10 seconds`);
      reject(new Error('Request timeout'));
    });

    req.end();
  });
};

/**
 * Test the ping functionality directly
 */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  // This block runs when the script is executed directly
  const testUrl = process.argv[2] || 'http://localhost:5000/api/health';

  console.log(`🔍 Testing ping to ${testUrl}`);
  pingServer(testUrl)
    .then(success => {
      if (success) {
        console.log('🎉 Ping test completed successfully');
      } else {
        console.log('⚠️ Ping test received an unsuccessful response');
      }
    })
    .catch(err => {
      console.error('💥 Ping test failed with error:', err.message);
    });
}
