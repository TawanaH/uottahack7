import MicRecorder from 'mic-recorder-to-mp3-fixed';
import { useState } from 'react';
import { useEffect } from 'react';
import "../components/formaudiostyle.css"


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
        blob: null
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
        recorder
          .stop()
          .getMp3()
          .then(([buffer, blob]) => {
            const blobURL = URL.createObjectURL(blob)
            setState({ blobURL, isRecording: false, blob: blob });
          }).catch((e) => console.log(e));
      };

      const sendAudioFile = async () => {
        const formData = new FormData();
        formData.append('audio', state.blob, 'recording.mp3'); // Append the MP3 file as 'audio' in FormData
      
        console.log('sending...', formData);
        // const response = await fetch('/your-server-endpoint', {
        //   method: 'POST',
        //   body: formData, // Send the FormData with the MP3 file
        // });
      
        // if (response.ok) {
        //   console.log('File sent successfully');
        // } else {
        //   console.error('Error sending file:', response.status);
        // }
      };

    return (
        <>
        <h2 style={{"margin-left": "-100px"}} className='heading'>Form Audio</h2>

        <div className='instructions'>

        <p><strong>In the [season] [year] semester I would like to take [course codes].</strong></p>
        <p><u>(Optional):</u> I want to take [number] electives, my options are [course codes]</p>
        <p><u>(Optional):</u> I want [criteria]</p>
        <p><u>Example Critera:</u> I want to avoid courses before 8:30am. I want to have no classes on Friday</p>        
        
        </div>

        <audio className="audio" src={state.blobURL} controls="controls" />
        <div className='bttns'>

        {state.isRecording ? <button className='audiobttn stop' onClick={stop} disabled={!state.isRecording}>Stop</button>:<button className='audiobttn' onClick={start} disabled={state.isRecording}>Record</button>}        
        <button className='audiobttn' onClick={sendAudioFile}>Go</button>
        </div>
        </>
    )
}