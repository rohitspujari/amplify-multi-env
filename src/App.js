import React, { useState } from 'react';
import logo from './logo.svg';
import './App.css';

import Amplify, { Storage, Predictions } from 'aws-amplify';
import { AmazonAIPredictionsProvider } from '@aws-amplify/predictions';
import awsConfig from './aws-exports';
import { withAuthenticator } from 'aws-amplify-react';

import mic from 'microphone-stream';

Amplify.configure(awsConfig);
Amplify.addPluggable(new AmazonAIPredictionsProvider());

function TextIdentification() {
  const [response, setResponse] = useState(
    'You can add a photo by uploading direcly from the app '
  );

  function identifyFromFile(event) {
    setResponse('identifiying text...');
    const {
      target: { files }
    } = event;
    const [file] = files || [];

    if (!file) {
      return;
    }
    Predictions.identify({
      text: {
        source: {
          file
        },
        format: 'PLAIN' // Available options "PLAIN", "FORM", "TABLE", "ALL"
      }
    })
      .then(({ text: { fullText } }) => {
        setResponse(fullText);
      })
      .catch(err => setResponse(JSON.stringify(err, null, 2)));
  }

  return (
    <div className="Text">
      <div>
        <h3>Text identification</h3>
        <input type="file" onChange={identifyFromFile} />
        <p>{response}</p>
      </div>
    </div>
  );
}

function SpeechToText(props) {
  const [response, setResponse] = useState(
    "Press 'start recording' to begin your transcription. Press STOP recording once you finish speaking."
  );

  function AudioRecorder(props) {
    const [recording, setRecording] = useState(false);
    const [micStream, setMicStream] = useState();
    const [audioBuffer] = useState(
      (function() {
        let buffer = [];
        function add(raw) {
          buffer = buffer.concat(...raw);
          return buffer;
        }
        function newBuffer() {
          console.log('reseting buffer');
          buffer = [];
        }

        return {
          reset: function() {
            newBuffer();
          },
          addData: function(raw) {
            return add(raw);
          },
          getData: function() {
            return buffer;
          }
        };
      })()
    );

    async function startRecording() {
      console.log('start recording');
      audioBuffer.reset();

      window.navigator.mediaDevices
        .getUserMedia({ video: false, audio: true })
        .then(stream => {
          const startMic = new mic();

          startMic.setStream(stream);
          startMic.on('data', chunk => {
            var raw = mic.toRaw(chunk);
            if (raw == null) {
              return;
            }
            audioBuffer.addData(raw);
          });

          setRecording(true);
          setMicStream(startMic);
        });
    }

    async function stopRecording() {
      console.log('stop recording');
      const { finishRecording } = props;

      micStream.stop();
      setMicStream(null);
      setRecording(false);

      const resultBuffer = audioBuffer.getData();

      if (typeof finishRecording === 'function') {
        finishRecording(resultBuffer);
      }
    }

    return (
      <div className="audioRecorder">
        <div>
          {recording && <button onClick={stopRecording}>Stop recording</button>}
          {!recording && (
            <button onClick={startRecording}>Start recording</button>
          )}
        </div>
      </div>
    );
  }

  function convertFromBuffer(bytes) {
    setResponse('Converting text...');

    Predictions.convert({
      transcription: {
        source: {
          bytes
        }
        // language: "en-US", // other options are "en-GB", "fr-FR", "fr-CA", "es-US"
      }
    })
      .then(({ transcription: { fullText } }) => setResponse(fullText))
      .catch(err => setResponse(JSON.stringify(err, null, 2)));
  }

  return (
    <div className="Text">
      <div>
        <h3>Speech to text</h3>
        <AudioRecorder finishRecording={convertFromBuffer} />
        <p>{response}</p>
      </div>
    </div>
  );
}

function TextToSpeech() {
  const [response, setResponse] = useState('...');
  const [textToGenerateSpeech, setTextToGenerateSpeech] = useState(
    'write to speech'
  );

  function generateTextToSpeech() {
    setResponse('Generating audio...');
    Predictions.convert({
      textToSpeech: {
        source: {
          text: textToGenerateSpeech
        }
        //voiceId: 'Amy' // default configured on aws-exports.js
        // list of different options are here https://docs.aws.amazon.com/polly/latest/dg/voicelist.html
      }
    })
      .then(result => {
        let AudioContext = window.AudioContext || window.webkitAudioContext;
        console.log({ AudioContext });
        const audioCtx = new AudioContext();
        const source = audioCtx.createBufferSource();
        audioCtx.decodeAudioData(
          result.audioStream,
          buffer => {
            source.buffer = buffer;
            source.connect(audioCtx.destination);
            source.start(0);
          },
          err => console.log({ err })
        );

        setResponse(`Generation completed, press play`);
      })
      .catch(err => setResponse(err));
  }

  function setText(event) {
    setTextToGenerateSpeech(event.target.value);
  }

  return (
    <div className="Text">
      <div>
        <h3>Text To Speech</h3>
        <input value={textToGenerateSpeech} onChange={setText} />
        <button onClick={generateTextToSpeech}>Text to Speech</button>
        <h3>{response}</h3>
      </div>
    </div>
  );
}

function TextTranslation() {
  const [response, setResponse] = useState(
    'Input some text and click enter to test'
  );
  const [textToTranslate, setTextToTranslate] = useState('write to translate');

  function translate() {
    Predictions.convert({
      translateText: {
        source: {
          text: textToTranslate
          // language : "es" // defaults configured on aws-exports.js
          // supported languages https://docs.aws.amazon.com/translate/latest/dg/how-it-works.html#how-it-works-language-codes
        }
        // targetLanguage: "en"
      }
    })
      .then(result => setResponse(JSON.stringify(result, null, 2)))
      .catch(err => setResponse(JSON.stringify(err, null, 2)));
  }

  function setText(event) {
    setTextToTranslate(event.target.value);
  }

  return (
    <div className="Text">
      <div>
        <h3>Text Translation</h3>
        <input value={textToTranslate} onChange={setText} />
        <button onClick={translate}>Translate</button>
        <p>{response}</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <TextTranslation />
      <TextToSpeech />
      <SpeechToText />
    </div>
  );
}

export default withAuthenticator(App, true);
