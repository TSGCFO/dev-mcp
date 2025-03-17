#!/usr/bin/env node
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

async function testCredentials() {
  console.log('Testing Azure Speech Service Credentials...');
  console.log('----------------------------------------');

  const credentials = {
    key: process.env.AZURE_SPEECH_KEY,
    region: process.env.AZURE_SPEECH_REGION,
    endpoint: process.env.AZURE_SPEECH_ENDPOINT
  };

  console.log('Environment Variables:');
  console.log('AZURE_SPEECH_KEY:', credentials.key ? `${credentials.key.substring(0, 10)}...` : 'undefined');
  console.log('AZURE_SPEECH_REGION:', credentials.region || 'undefined');
  console.log('AZURE_SPEECH_ENDPOINT:', credentials.endpoint || 'undefined');
  console.log('----------------------------------------');

  if (!credentials.key) {
    console.error('❌ ERROR: AZURE_SPEECH_KEY is not set');
    process.exit(1);
  }

  if (!credentials.region) {
    console.error('❌ ERROR: AZURE_SPEECH_REGION is not set');
    process.exit(1);
  }

  if (!credentials.endpoint) {
    console.error('❌ ERROR: AZURE_SPEECH_ENDPOINT is not set');
    process.exit(1);
  }

  console.log('✅ All required credentials are present');
  console.log('Testing connection to Azure Speech Service...');

  try {
    const speechConfig = sdk.SpeechConfig.fromSubscription(credentials.key, credentials.region);
    if (speechConfig) {
      console.log('✅ Successfully created speech config');
      
      // Try to create a synthesizer
      const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
      if (synthesizer) {
        console.log('✅ Successfully created speech synthesizer');
        
        // Try a simple synthesis
        console.log('Testing speech synthesis...');
        const result = await new Promise((resolve, reject) => {
          synthesizer.speakTextAsync(
            'Test successful',
            result => {
              synthesizer.close();
              resolve(result);
            },
            error => {
              synthesizer.close();
              reject(error);
            }
          );
        });
        
        console.log('✅ Successfully synthesized speech');
      }
    }
  } catch (error) {
    console.error('❌ Error testing Azure Speech Service:', error);
    process.exit(1);
  }

  console.log('✅ All tests passed successfully');
}

testCredentials().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});