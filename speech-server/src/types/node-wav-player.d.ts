declare module 'node-wav-player' {
  interface PlayOptions {
    path: string;
    sync?: boolean;
    seek?: number;
  }

  interface WavPlayer {
    play(options: PlayOptions): Promise<void>;
    stop(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    speed: number;
    loop: boolean;
    loopStart?: number;
    loopEnd?: number;
    currentTime?: number;
    seek(time: number): Promise<void>;
  }

  const player: WavPlayer;
  export = player;
}