import * as fs from 'fs/promises';
import * as path from 'path';

export interface VoiceProfile {
  name: string;
  voice: string;
  speed: number;
  pitch: number;
  volume: number;
  effects: {
    echo: boolean;
    reverb: number;
    equalizer: {
      bass: number;
      mid: number;
      treble: number;
    }
  }
}

export class VoiceManager {
  private profiles: Map<string, VoiceProfile>;
  private configPath: string;
  private defaultProfile: VoiceProfile = {
    name: 'default',
    voice: 'en-US-JennyNeural',
    speed: 1.0,
    pitch: 0,
    volume: 1.0,
    effects: {
      echo: false,
      reverb: 0,
      equalizer: {
        bass: 0,
        mid: 0,
        treble: 0
      }
    }
  };

  constructor() {
    this.profiles = new Map();
    this.configPath = path.join(process.cwd(), 'config', 'voice-profiles.json');
    this.loadProfiles().catch(error => {
      console.error('Error loading voice profiles:', error);
    });
  }

  private async loadProfiles() {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      try {
        const data = await fs.readFile(this.configPath, 'utf-8');
        const profiles = JSON.parse(data);
        
        // Validate and load each profile
        for (const [name, profile] of Object.entries(profiles)) {
          if (this.validateProfile(profile as VoiceProfile)) {
            this.profiles.set(name, profile as VoiceProfile);
          }
        }
      } catch (error) {
        // If file doesn't exist or is invalid, create with default profile
        this.profiles.set('default', this.defaultProfile);
        await this.saveProfiles();
      }

      // Ensure default profile exists
      if (!this.profiles.has('default')) {
        this.profiles.set('default', this.defaultProfile);
        await this.saveProfiles();
      }
    } catch (error) {
      console.error('Error in loadProfiles:', error);
      // Set default profile as fallback
      this.profiles.set('default', this.defaultProfile);
    }
  }

  private async saveProfiles() {
    try {
      const data = Object.fromEntries(this.profiles.entries());
      await fs.writeFile(this.configPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving voice profiles:', error);
    }
  }

  private validateProfile(profile: VoiceProfile): boolean {
    if (!profile.name || typeof profile.name !== 'string') return false;
    if (!profile.voice || typeof profile.voice !== 'string') return false;
    if (typeof profile.speed !== 'number' || profile.speed < 0.25 || profile.speed > 4.0) return false;
    if (typeof profile.pitch !== 'number' || profile.pitch < -20 || profile.pitch > 20) return false;
    if (typeof profile.volume !== 'number' || profile.volume < 0 || profile.volume > 1) return false;

    if (typeof profile.effects !== 'object') return false;
    if (typeof profile.effects.echo !== 'boolean') return false;
    if (typeof profile.effects.reverb !== 'number' || profile.effects.reverb < 0 || profile.effects.reverb > 1) return false;

    const eq = profile.effects.equalizer;
    if (typeof eq !== 'object') return false;
    if (typeof eq.bass !== 'number' || eq.bass < -15 || eq.bass > 15) return false;
    if (typeof eq.mid !== 'number' || eq.mid < -15 || eq.mid > 15) return false;
    if (typeof eq.treble !== 'number' || eq.treble < -15 || eq.treble > 15) return false;

    return true;
  }

  async getProfile(name: string): Promise<VoiceProfile> {
    const profile = this.profiles.get(name);
    if (!profile) {
      throw new Error(`Voice profile '${name}' not found`);
    }
    return profile;
  }

  async getDefaultProfile(): Promise<VoiceProfile> {
    return this.profiles.get('default') || this.defaultProfile;
  }

  async createProfile(profile: VoiceProfile): Promise<void> {
    if (!this.validateProfile(profile)) {
      throw new Error('Invalid profile configuration');
    }

    if (this.profiles.has(profile.name)) {
      throw new Error(`Profile '${profile.name}' already exists`);
    }

    this.profiles.set(profile.name, profile);
    await this.saveProfiles();
  }

  async updateProfile(profile: VoiceProfile): Promise<void> {
    if (!this.validateProfile(profile)) {
      throw new Error('Invalid profile configuration');
    }

    if (!this.profiles.has(profile.name)) {
      throw new Error(`Profile '${profile.name}' not found`);
    }

    this.profiles.set(profile.name, profile);
    await this.saveProfiles();
  }

  async deleteProfile(name: string): Promise<void> {
    if (name === 'default') {
      throw new Error('Cannot delete default profile');
    }

    if (!this.profiles.has(name)) {
      throw new Error(`Profile '${name}' not found`);
    }

    this.profiles.delete(name);
    await this.saveProfiles();
  }

  async listProfiles(): Promise<VoiceProfile[]> {
    return Array.from(this.profiles.values());
  }
}