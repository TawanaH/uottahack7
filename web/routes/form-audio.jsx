import MicRecorder from 'mic-recorder-to-mp3-fixed';
import { useState } from 'react';
import { useEffect } from 'react';


export default function() {

    const [recorder, setRecorder] = useState(null); 

    useEffect(() => {
        const Mp3RecorderInstance = new MicRecorder({ bitRate: 128 });
        setRecorder(Mp3RecorderInstance); // Store the instance when the component mounts
    }, []); 

    const [state, setState] = useState({
        isRecording: false,
        blobURL: '',
        isBlocked: false,
    })


    const start = () => {
        if (state.isBlocked) {
          console.log('Permission Denied');
        } else {
          recorder
            .start()
            .then(() => {
              setState({ isRecording: true });
              console.log("Started!", recorder);
            }).catch((e) => console.error(e));
        }
      };

    const stop = () => {
        // console.log(Mp3Recorder)
        recorder
          .stop()
          .getMp3()
          .then(([buffer, blob]) => {
            const blobURL = URL.createObjectURL(blob)
            setState({ blobURL, isRecording: false });
            console.log(blobURL)
          }).catch((e) => console.log(e));



        // if (recorder && recorder.activeStream) {
        //     recorder.stop().then(() => {
        //         recorder.getMp3().then(([buffer, blob]) => {
        //             const blobURL = URL.createObjectURL(blob);
        //             setState({ blobURL, isRecording: false });
        //             console.log(blobURL);
        //         }).catch((e) => console.error("Error getting MP3:", e));
        //     }).catch((e) => console.error("Error stopping recording:", e));
        // } else {
        //     console.error('Recorder not initialized or stream is not active', recorder);
        // }
      };

    const printObj =() => {
        console.log(recorder)
    }

    return (
        <>
        <h2>Form Audio</h2>

        <button onClick={start} disabled={state.isRecording}>
        Record
        </button>
        <button onClick={stop} disabled={!state.isRecording}>
        Stop
        </button>
        <audio src={state.blobURL} controls="controls" />
        <br></br>
        <br></br>
        <button onClick={printObj}>Print</button>
        </>
    )
}