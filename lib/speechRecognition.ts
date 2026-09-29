/**
 * Web Speech API 語音辨識服務封裝 (支援繁體中文 zh-TW)
 */

export interface SpeechRecognitionResultPayload {
  transcript: string;
  isFinal: boolean;
}

export type SpeechCallback = (result: SpeechRecognitionResultPayload) => void;
export type StateCallback = (isListening: boolean, error?: string) => void;

class SpeechRecognitionService {
  private recognition: any = null;
  private isListening: boolean = false;
  private onResultCallback: SpeechCallback | null = null;
  private onStateCallback: StateCallback | null = null;
  private isSupported: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition ||
        null;

      if (SpeechRecognition) {
        this.isSupported = true;
        try {
          this.recognition = new SpeechRecognition();
          this.recognition.continuous = true;
          this.recognition.interimResults = true;
          this.recognition.lang = 'zh-TW';

          this.recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              } else {
                interimTranscript += event.results[i][0].transcript;
              }
            }

            const currentText = finalTranscript || interimTranscript;
            if (this.onResultCallback && currentText) {
              this.onResultCallback({
                transcript: currentText,
                isFinal: Boolean(finalTranscript)
              });
            }
          };

          this.recognition.onerror = (event: any) => {
            console.warn('Speech recognition error:', event.error);
            let errorMsg = '語音辨識發生異常';
            if (event.error === 'not-allowed') {
              errorMsg = '麥克風權限被拒絕，請在瀏覽器設定中允許麥克風';
            } else if (event.error === 'no-speech') {
              errorMsg = '未偵測到聲音，請再試一次';
            } else if (event.error === 'network') {
              errorMsg = '網路連線異常，請手動輸入';
            }
            if (this.onStateCallback) {
              this.onStateCallback(this.isListening, errorMsg);
            }
          };

          this.recognition.onend = () => {
            this.isListening = false;
            if (this.onStateCallback) {
              this.onStateCallback(false);
            }
          };
        } catch (e) {
          console.error('Failed to initialize SpeechRecognition:', e);
          this.isSupported = false;
        }
      }
    }
  }

  public checkSupport(): boolean {
    return this.isSupported;
  }

  public start(onResult: SpeechCallback, onState?: StateCallback): boolean {
    if (!this.isSupported || !this.recognition) {
      if (onState) onState(false, '您的瀏覽器不支援語音辨識，請使用鍵盤輸入');
      return false;
    }

    try {
      this.onResultCallback = onResult;
      this.onStateCallback = onState || null;
      this.recognition.start();
      this.isListening = true;
      if (this.onStateCallback) {
        this.onStateCallback(true);
      }
      return true;
    } catch (e) {
      console.warn('Recognition start failed or already active:', e);
      return false;
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
      this.isListening = false;
      if (this.onStateCallback) {
        this.onStateCallback(false);
      }
    }
  }

  public toggle(onResult: SpeechCallback, onState?: StateCallback): boolean {
    if (this.isListening) {
      this.stop();
      return false;
    } else {
      return this.start(onResult, onState);
    }
  }
}

export const speechService = new SpeechRecognitionService();
