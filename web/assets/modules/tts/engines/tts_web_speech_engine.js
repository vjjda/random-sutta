// Path: web/assets/modules/tts/engines/tts_web_speech_engine.js
import { getLogger } from '../../utils/logger.js'; // [FIXED] Correct relative path (2 levels up)

const logger = getLogger("TTS_WebSpeech");

export class TTSWebSpeechEngine {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voice = null;
        this.rate = 1.0;
        this.pitch = 1.0;
        this.onVoicesChanged = null;
        
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => {
                this._loadVoices();
                if (this.onVoicesChanged) this.onVoicesChanged(this.getVoices());
            };
        }
        this._loadVoices();
        this._loadSettings();
    }

    _loadVoices() {
        const voices = this.synth.getVoices();
        if (!this.voice && voices.length > 0) {
             this.voice = voices.find(v => v.name.includes("Google US English")) || 
                          voices.find(v => v.lang === "en-US") || 
                          voices.find(v => v.lang.startsWith("en"));
        }
    }

    _loadSettings() {
        const savedRate = localStorage.getItem("tts_rate");
        const savedVoiceURI = localStorage.getItem("tts_voice_uri");
        if (savedRate) this.rate = parseFloat(savedRate);
        if (savedVoiceURI) {
            const voices = this.synth.getVoices();
            const found = voices.find(v => v.voiceURI === savedVoiceURI);
            if (found) this.voice = found;
        }
    }

    getVoices() {
        return this.synth.getVoices().filter(v => v.lang.startsWith('en'));
    }

    setVoice(voiceURI) {
        const voices = this.synth.getVoices();
        const found = voices.find(v => v.voiceURI === voiceURI);
        if (found) {
            this.voice = found;
            localStorage.setItem("tts_voice_uri", voiceURI);
        }
    }

    setRate(rate) {
        this.rate = parseFloat(rate);
        localStorage.setItem("tts_rate", this.rate);
    }

    speak(text, onEnd, onBoundary) {
        if (this.synth.speaking) this.synth.cancel();
        if (!text) { if (onEnd) onEnd(); return; }

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) utterance.voice = this.voice;
        utterance.rate = this.rate;
        utterance.pitch = this.pitch;

        utterance.onend = () => { if (onEnd) onEnd(); };
        utterance.onerror = (e) => {
            logger.error("Speak error", e);
            if (e.error !== 'interrupted' && onEnd) onEnd();
        };
        if (onBoundary) utterance.onboundary = onBoundary;

        this.synth.speak(utterance);
    }

    pause() { this.synth.pause(); }
    resume() { this.synth.resume(); }
    stop() { this.synth.cancel(); }
}