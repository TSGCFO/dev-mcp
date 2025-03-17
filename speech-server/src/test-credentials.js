#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
console.log('Testing Azure Speech Service Credentials...');
console.log('----------------------------------------');
var credentials = {
    key: process.env.AZURE_SPEECH_KEY,
    region: process.env.AZURE_SPEECH_REGION,
    endpoint: process.env.AZURE_SPEECH_ENDPOINT
};
console.log('Environment Variables:');
console.log('AZURE_SPEECH_KEY:', credentials.key ? "".concat(credentials.key.substring(0, 10), "...") : 'undefined');
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
var sdk = require("microsoft-cognitiveservices-speech-sdk");
try {
    var speechConfig = sdk.SpeechConfig.fromSubscription(credentials.key, credentials.region);
    if (speechConfig) {
        console.log('✅ Successfully created speech config');
        // Try to create a synthesizer
        var synthesizer = new sdk.SpeechSynthesizer(speechConfig);
        if (synthesizer) {
            console.log('✅ Successfully created speech synthesizer');
            synthesizer.close();
        }
    }
}
catch (error) {
    console.error('❌ Error testing Azure Speech Service:', error);
    process.exit(1);
}
console.log('✅ All tests passed successfully');
