import { useState } from "react";
import "../components/formstyle.css"

import AvailableTimes from 'react-available-times';
// import { start } from "repl";

export default function () {
    const terms = ['Winter 2025', 'Summer 2025', 'Fall 2025']
  const [totalClasses, setTotalClasses] = useState(5); // Default total classes
  const [electiveCount, setElectiveCount] = useState(totalClasses); // Initial elective count
  const [mandatoryClasses, setMandatoryClasses] = useState([]);
  const [electiveClasses, setElectiveClasses] = useState([]);
  const [additionalRequest, setAdditionalRequest] = useState("");
  const [term, setTerm] = useState(terms[0]);
  const [calendarData, setCalendarData] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  // Handle total class input
  const handleTotalClassesChange = (e) => {
    const newTotal = parseInt(e.target.value, 10);
    setTotalClasses(newTotal);
    setElectiveCount(newTotal-mandatoryClasses.length);
  };

  //handle term input
  const handleTermChange = (e) => {
    setTerm(e.target.value);
  };

  // Handle adding an elective class
  const handleElectiveClassChange = (value) => {
    setElectiveClasses(value.split(','));
  };

  // Handle class input changes
  const handleClassChange = (value) => {
    setMandatoryClasses(value.replace(/\s/g, "").split(','));
    setElectiveCount(totalClasses-mandatoryClasses.length);
  };


  // Handle submission
  const handleSubmit = (e) => {
    e.preventDefault();
    const mandatoryClassesCount = mandatoryClasses.length
    let avail = "";
    const DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    calendarData.forEach((e) => {
        if (avail !== "") {
            avail +=", "
        }
        let day = Math.floor(e.start/1440)
        console.log(day)
        let startTime = (e.start-day*1440)/60
        avail += DOW[day-1]+": "+ startTime+":00-"+(startTime+1)+":00"
    })
    const submitObj = {
        term: term,
        electiveClassesCount: totalClasses-mandatoryClassesCount,
        mandatoryClasses: mandatoryClasses,
        electiveClasses: electiveClasses,
        additionalRequests: additionalRequest,
        calendarData: avail
    }
    console.log("SUBMITTED: ", submitObj)
    setSubmitted(true);
  };

  return (
    <>
    <h2 className="heading">Your Ideal Schedule</h2>
    <div>
        <a href="/form-audio">Use Audio!</a>
    </div>
<div class="container">

    <div class="form_area">
        <form action="" onSubmit={handleSubmit}>
            <div class="form_group">
            <label className="sub_title">
            Term:
            </label>
            <select className="form_style" 
              value={term}
              onChange={handleTermChange}
            >
              {terms.map((v, i) => (
                <option key={i} value={v}>
                  {v}
                </option>
              ))}
            </select>
            </div>

            <div className="form_group">
            <label className="sub_title">
            Total Classes:
            </label>
            <select className="form_style"
              value={totalClasses}
              onChange={handleTotalClassesChange}
            >
              {[...Array(6)].map((_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            </div>

            <div className="form_group">
            <label className="sub_title">
              Mandatory Classes: 
              </label>
              <input className="form_style"
                type="text"
                onChange={(e) =>
                  handleClassChange(e.target.value)
                }
                required
              />
            </div>

            <div className="form_group">

            <label className="sub_title">
              Elective Classes:
              </label>
              <input className="form_style"
                type="text"
                onChange={(e) =>
                    handleElectiveClassChange(e.target.value)
                }
                />
            <div style={{"padding": "10px 20px", "fontSize": "12px"}}>{electiveCount} electives will be added to your schedule</div>
                </div>

                <div className="form_group">
                <label className="sub_title">Additional Request</label>
        <textarea className="form_style"
          value={additionalRequest}
          onChange={(e) => setAdditionalRequest(e.target.value)}
          placeholder="Enter any additional requests here..."
          style={{
            width: "100%",
            height: "80px",
            borderRadius: "5px",
            padding: "5px",
          }}
        />

        <button
          type="submit"
          className="btn"
        >
          Submit
        </button>
                </div>
        </form>

    </div>

        <div className="cal form_group" >
            <label className="sub_title">Select Your Unavailbility:</label>
        {/* Calendar Section */}
        <AvailableTimes
            availableDays={['monday', 'tuesday', 'wednesday', 'thursday', 'friday']}
            onChange={(selections) => {
                setCalendarData(selections)
            }}
            recurring={true}
            height={"500px"}
            availableHourRange={{ start: 7, end: 22 }}
            />

            </div>

    </div>

    </>
  );
}