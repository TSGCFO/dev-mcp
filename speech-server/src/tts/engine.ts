import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { VoiceProfile } from './voices.js';

interface PlaybackOptions {
  speed?: number;
  skipSilence?: boolean;
  wordHighlighting?: boolean;
  bookmarks?: Bookmark[];
  loop?: {
    enabled: boolean;
    start: number;
    end: number;
  };
}

interface Bookmark {
  id: string;
  position: number;
  label: string;
}

export class TTSEngine {
  private currentReadingId: string | null = null;
  private isPlaying: boolean = false;
  private synthesizer: sdk.SpeechSynthesizer | null = null;
  private speechConfig: sdk.SpeechConfig | null = null;
  private currentProfile: VoiceProfile | null = null;
  private currentText: string = '';
  private currentVoiceName: string = "en-US-JennyNeural";

  constructor() {
    this.initializeSpeechConfig();
  }

  private validateEnvironment() {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;

    if (!key) {
      throw new Error('AZURE_SPEECH_KEY environment variable is not set');
    }

    if (!region) {
      throw new Error('AZURE_SPEECH_REGION environment variable is not set');
    }

    return { key, region };
  }

  private initializeSpeechConfig() {
    try {
      console.log('Initializing Azure Speech config...');
      const { key, region } = this.validateEnvironment();
      console.log(`Using region: ${region}`);

      this.speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
      
      if (this.speechConfig) {
        this.speechConfig.speechSynthesisVoiceName = this.currentVoiceName;
        this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);
        console.log('Speech config initialized successfully');
      } else {
        throw new Error('Failed to initialize speech config');
      }
    } catch (error) {
      console.error('Error initializing speech config:', error);
      throw error;
    }
  }

  async configure(profile: VoiceProfile) {
    this.currentProfile = profile;
    this.currentVoiceName = this.mapVoiceProfile(profile);
    
    if (this.speechConfig) {
      this.speechConfig.speechSynthesisVoiceName = this.currentVoiceName;
      // Recreate synthesizer with new config
      if (this.synthesizer) {
        this.synthesizer.close();
      }
      this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);
    }
  }

  async speak(text: string): Promise<string> {
    const readingId = Math.random().toString(36).substring(7);
    this.currentReadingId = readingId;
    this.currentText = text;

    try {
      console.log('Starting speech synthesis...');
      
      // Split text into paragraphs for better synthesis
      const paragraphs = text.split(/\n\s*\n/);
      
      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i].trim();
        if (!paragraph) continue;

        console.log(`Synthesizing paragraph ${i + 1} of ${paragraphs.length}...`);
        await this.synthesizeParagraph(paragraph);
      }

      return readingId;
    } catch (error) {
      console.error('Error in TTS:', error);
      throw error;
    }
  }

  private mapVoiceProfile(profile: VoiceProfile | null): string {
    if (!profile) return "en-US-JennyNeural";

    // Map based on profile characteristics
    if (profile.pitch > 0) {
      return profile.voice.toLowerCase().includes("male") 
        ? "en-US-GuyNeural" 
        : "en-US-AriaNeural";
    } else if (profile.pitch < 0) {
      return profile.voice.toLowerCase().includes("female") 
        ? "en-US-JennyNeural" 
        : "en-US-DavisNeural";
    }

    // Map based on voice name
    const voiceName = profile.voice.toLowerCase();
    if (voiceName.includes("jenny")) return "en-US-JennyNeural";
    if (voiceName.includes("guy")) return "en-US-GuyNeural";
    if (voiceName.includes("aria")) return "en-US-AriaNeural";
    if (voiceName.includes("davis")) return "en-US-DavisNeural";
    if (voiceName.includes("amber")) return "en-US-AmberNeural";
    if (voiceName.includes("nancy")) return "en-US-NancyNeural";
    if (voiceName.includes("tony")) return "en-US-TonyNeural";
    if (voiceName.includes("sara")) return "en-US-SaraNeural";

    return "en-US-JennyNeural"; // Default voice
  }

  private async synthesizeParagraph(text: string): Promise<void> {
    if (!this.synthesizer || !this.speechConfig) {
      throw new Error('Speech synthesizer not initialized');
    }

    return new Promise((resolve, reject) => {
      this.isPlaying = true;

      // Configure SSML for more natural speech
      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
          <voice name="${this.currentVoiceName}">
            <prosody rate="${this.currentProfile?.speed || 1}" pitch="${this.currentProfile?.pitch || 0}%">
              ${text}
            </prosody>
          </voice>
        </speak>
      `;

      this.synthesizer!.speakSsmlAsync(
        ssml,
        result => {
          if (result.errorDetails) {
            this.isPlaying = false;
            reject(new Error(result.errorDetails));
          } else {
            this.isPlaying = false;
            resolve();
          }
        },
        error => {
          this.isPlaying = false;
          reject(error);
        }
      );
    });
  }

  async play(options?: PlaybackOptions) {
    if (!this.isPlaying) return;
    
    if (options?.speed && this.currentProfile) {
      this.currentProfile.speed = options.speed;
      // Restart speech with new speed
      await this.stop();
      await this.speak(this.currentText);
    }
  }

  async pause() {
    if (this.synthesizer && this.isPlaying) {
      await this.stop();
      this.isPlaying = false;
    }
  }

  async resume() {
    if (this.synthesizer && !this.isPlaying && this.currentText) {
      await this.speak(this.currentText);
    }
  }

  async stop() {
    if (this.synthesizer) {
      this.synthesizer.close();
      this.isPlaying = false;
      // Reinitialize synthesizer for next use
      this.initializeSpeechConfig();
    }
  }

  async addBookmark(): Promise<Bookmark> {
    if (!this.isPlaying) throw new Error('No active playback');
    
    const bookmark: Bookmark = {
      id: Math.random().toString(36).substring(7),
      position: 0, // We would need to track current position
      label: `Bookmark at ${new Date().toISOString()}`
    };

    return bookmark;
  }

  async setLoop(loop: { enabled: boolean; start: number; end: number }) {
    // Azure TTS doesn't support looping directly
    // We would need to implement this by re-synthesizing the text
  }

  async cleanup() {
    await this.stop();
    if (this.synthesizer) {
      this.synthesizer.close();
      this.synthesizer = null;
    }
    if (this.speechConfig) {
      this.speechConfig = null;
    }
  }
}