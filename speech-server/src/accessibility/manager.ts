export class AccessibilityManager {
  private isHighlightingEnabled: boolean = false;

  async enableHighlighting(): Promise<void> {
    this.isHighlightingEnabled = true;
  }

  async disableHighlighting(): Promise<void> {
    this.isHighlightingEnabled = false;
  }

  isHighlighting(): boolean {
    return this.isHighlightingEnabled;
  }
}