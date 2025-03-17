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

export class ProfileManager {
  private profiles: Map<string, VoiceProfile>;
  private configPath: string;
  private defaultProfile: VoiceProfile = {
    name: 'default',
    voice: 'en-US-Neural2-D',
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
    this.configPath = path.join(process.cwd(), 'voice-profiles.json');
    this.loadProfiles();
  }

  private async loadProfiles() {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const profiles = JSON.parse(data);
      
      // Validate and load each profile
      for (const [name, profile] of Object.entries(profiles)) {
        if (this.validateProfile(profile as VoiceProfile)) {
          this.profiles.set(name, profile as VoiceProfile);
        }
      }

      // Ensure default profile exists
      if (!this.profiles.has('default')) {
        this.profiles.set('default', this.defaultProfile);
        await this.saveProfiles();
      }
    } catch (error) {
      // Create default profile if no config exists
      this.profiles.set('default', this.defaultProfile);
      await this.saveProfiles();
    }
  }

  private async saveProfiles() {
    const data = Object.fromEntries(this.profiles.entries());
    await fs.writeFile(this.configPath, JSON.stringify(data, null, 2));
  }

  private validateProfile(profile: VoiceProfile): boolean {
    // Check required fields
    if (!profile.name || typeof profile.name !== 'string') {
      return false;
    }

    if (!profile.voice || typeof profile.voice !== 'string') {
      return false;
    }

    // Validate numeric ranges
    if (typeof profile.speed !== 'number' || profile.speed < 0.25 || profile.speed > 4.0) {
      return false;
    }

    if (typeof profile.pitch !== 'number' || profile.pitch < -20 || profile.pitch > 20) {
      return false;
    }

    if (typeof profile.volume !== 'number' || profile.volume < 0 || profile.volume > 1) {
      return false;
    }

    // Validate effects
    if (typeof profile.effects !== 'object') {
      return false;
    }

    if (typeof profile.effects.echo !== 'boolean') {
      return false;
    }

    if (typeof profile.effects.reverb !== 'number' || profile.effects.reverb < 0 || profile.effects.reverb > 1) {
      return false;
    }

    // Validate equalizer settings
    const eq = profile.effects.equalizer;
    if (typeof eq !== 'object') {
      return false;
    }

    if (typeof eq.bass !== 'number' || eq.bass < -15 || eq.bass > 15) {
      return false;
    }

    if (typeof eq.mid !== 'number' || eq.mid < -15 || eq.mid > 15) {
      return false;
    }

    if (typeof eq.treble !== 'number' || eq.treble < -15 || eq.treble > 15) {
      return false;
    }

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

  async exportProfile(name: string, exportPath: string): Promise<void> {
    const profile = await this.getProfile(name);
    await fs.writeFile(exportPath, JSON.stringify(profile, null, 2));
  }

  async importProfile(importPath: string): Promise<void> {
    const data = await fs.readFile(importPath, 'utf-8');
    const profile = JSON.parse(data);

    if (!this.validateProfile(profile)) {
      throw new Error('Invalid profile configuration in import file');
    }

    await this.createProfile(profile);
  }

  async cloneProfile(sourceName: string, newName: string): Promise<void> {
    const sourceProfile = await this.getProfile(sourceName);
    const newProfile = {
      ...sourceProfile,
      name: newName
    };

    await this.createProfile(newProfile);
  }

  async resetProfile(name: string): Promise<void> {
    if (name === 'default') {
      this.profiles.set('default', this.defaultProfile);
    } else {
      throw new Error('Can only reset default profile');
    }
    await this.saveProfiles();
  }
}