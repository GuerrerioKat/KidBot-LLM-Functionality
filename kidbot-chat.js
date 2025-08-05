console.log('[KidBot] script loaded');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognizer = SpeechRecognition ? new SpeechRecognition() : null;

if (recognizer) {
  recognizer.lang = 'en-US';
  recognizer.continuous = true;
  recognizer.interimResults = false;   // we only need the final string
  recognizer.maxAlternatives = 1;
} else {
  console.warn('[KidBot] SpeechRecognition not supported in this browser');
}

document.addEventListener('DOMContentLoaded', () => {
    // Chatbot send button for text input
    const btn = document.getElementById('kidbot-send');
    if (!btn) return console.error('[KidBot] send button missing');
    btn.addEventListener('click', sendToKidbot);
    
    // Chatbot mic button for voice input
    const micBtn  = document.getElementById('kidbot-mic');
    const inputEl = document.getElementById('kidbot-input');
    const out = document.getElementById('kidbot-response');

    if (micBtn && recognizer) {
        // micBtn.addEventListener('pointerdown', () => {
        //     recognizer.start();
        //     console.log('[KidBot] recognizer.start()'); // tell me when the recognizer starts
        // });
        // micBtn.addEventListener('pointerup',    () => recognizer.stop());
        // micBtn.addEventListener('pointerleave', () => recognizer.stop());

        try {
          recognizer.start();            // ask for mic permission & start listening
          console.log('[KidBot] recognizer.start() — hands-free mode');
          out.innerText = '🎤 Listening…';
        } catch (err) {
            // Chrome throws InvalidStateError if start is called while already active
            console.warn('[KidBot] recognizer already active', err);
        }

        let lastTranscript = '';

        recognizer.addEventListener('result', ev => {
          const res = ev.results[ev.resultIndex];
          if (!res.isFinal) return;

          const transcript = res[0].transcript.trim();
          if (!transcript || transcript === lastTranscript) return;
          console.log('[KidBot] Transcript:', transcript); // print out the transcript
          if (out) out.innerText = `🗣 You said: “${transcript}”`;

          lastTranscript = transcript;
          inputEl.value  = transcript;
          sendToKidbot();
        });

        recognizer.addEventListener('end', () => {
          console.log('[KidBot] recognizer ended — restarting');
          try { recognizer.start(); } catch (_) { /* ignore double-starts */ }
        });
        
        micBtn.addEventListener('click', () => {
            recognizer.start();
            console.log('[KidBot] recognizer.start()');
            out.innerText = '🎤 Listening…';
        });

        recognizer.addEventListener('speechend', () => {
            console.log('[KidBot] speechend — stopping recognizer');
            recognizer.stop();
        });
       
        //Tell me if there's an error
        recognizer.addEventListener('error', (e) =>
            console.error('[KidBot] recognizer error:', e.error)
        );
    }
});

async function sendToKidbot() {
  console.log('[KidBot] sendToKidbot() start');
  
  async function speak(text) {
    const apiKey = kidbotChatSettings.elevenLabsApiKey || 'Not Found';
    const voiceId = '21m00Tcm4TlvDq8ikWAM';

    // --- ADD THIS LINE ---
    console.log('[KidBot] ElevenLabs API Key (first few chars):', apiKey ? apiKey.substring(0, 5) + '...' : 'Not found');
    // --- END ADDITION ---


    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
        },
        body: JSON.stringify({
            text: text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75
            }
        })
    });

    if (!response.ok) {
        console.error("ElevenLabs TTS failed");
        return;
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
 }


  const inputEl = document.getElementById('kidbot-input');
  if (!inputEl) return console.error('[KidBot] input not found');
  const question = inputEl.value.trim();
  console.log('[KidBot] Question:', question);

  const out = document.getElementById('kidbot-response');
  out.innerText = '⏳ Thinking…';

  try {
    const resp = await fetch(kidbotChatSettings.ajaxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action:   'kidbot_ask',
        question: question,
        post_id:  kidbotChatSettings.postId
      })
    });
    console.log('[KidBot] fetch status', resp.status);
    const data = await resp.json();
    console.log('[KidBot] parsed JSON:', data);

    if (!data.success) {
      console.warn('[KidBot] server error:', data.data);
      out.innerText = data.data.message || 'Server error';
      return;
    }

    out.innerText = data.data.reply;
    console.log('[KidBot] Final answer:', data.data.reply);
    speak(data.data.reply);
  } catch (err) {
    console.error('[KidBot] network or parse error:', err);
    out.innerText = 'Network error – see console';
  }
}