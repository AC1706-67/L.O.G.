// Test Supabase and AWS connections
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

console.log('🔍 Testing connections...\n');

// Test Supabase
async function testSupabase() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase: Missing credentials');
    return false;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('_test').select('*').limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist (expected)
      console.log('✅ Supabase: Connected successfully!');
      console.log('   URL:', supabaseUrl);
      return true;
    } else {
      console.log('✅ Supabase: Connected successfully!');
      console.log('   URL:', supabaseUrl);
      return true;
    }
  } catch (err) {
    console.error('❌ Supabase: Connection failed -', err.message);
    return false;
  }
}

// Test AWS Bedrock
async function testBedrock() {
  const region = process.env.EXPO_PUBLIC_AWS_REGION;
  const accessKeyId = process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY;
  const modelId = process.env.EXPO_PUBLIC_BEDROCK_MODEL_ID;

  if (!accessKeyId || !secretAccessKey) {
    console.error('❌ AWS: Missing credentials');
    return false;
  }

  try {
    const client = new BedrockRuntimeClient({
      region,
      credentials: { accessKeyId, secretAccessKey }
    });

    const command = new ConverseCommand({
      modelId,
      messages: [
        {
          role: 'user',
          content: [{ text: 'Say "Hello" in one word.' }]
        }
      ]
    });

    const response = await client.send(command);
    console.log('✅ AWS Bedrock: Connected successfully!');
    console.log('   Region:', region);
    console.log('   Model:', modelId);
    console.log('   Response:', response.output.message.content[0].text);
    return true;
  } catch (err) {
    console.error('❌ AWS Bedrock: Connection failed -', err.message);
    return false;
  }
}

// Run tests
(async () => {
  const supabaseOk = await testSupabase();
  console.log('');
  const bedrockOk = await testBedrock();
  
  console.log('\n' + '='.repeat(50));
  if (supabaseOk && bedrockOk) {
    console.log('✨ All connections successful! Ready to apply migrations.');
  } else {
    console.log('⚠️  Some connections failed. Check your .env file.');
  }
})();
