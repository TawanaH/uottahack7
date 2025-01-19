import React, { useState, useEffect } from "react";
import { useLocation } from "react-router";
import "../components/schedule.css"

const Schedule = () => {
  
  const location = useLocation()
  const state = location.state || {}
  const res = state?.schedules || {};
  const scheduleResponse = JSON.parse(res)
  const times = [
    "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"
  ];

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  const [tasks, setTasks] = useState(
    times.reduce((acc, time) => {
      acc[time] = {}; // Initialize tasks for each time slot
      return acc;
    }, {})
  );

  const [currentSchedule, setCurrentSchedule] = useState(1);
  const [scheduleData, setScheduleData] = useState(scheduleResponse["schedules"]);
  const [visibleIndex, setVisibleIndex] = useState(null); // State to track which course info is visible
  const [visibleCourse, setVisibleCourse] = useState(null);


  useEffect(() => {
    const loadSchedule = () => {
      // Clear out previous tasks
      const newTasks = times.reduce((acc, time) => {
        acc[time] = {}; // Initialize empty tasks
        return acc;
      }, {});

      // Loop through the courses for the current schedule
      const currentScheduleData = scheduleData[currentSchedule - 1];

      currentScheduleData.courses.forEach((course) => {
        const courseDay = course.day.split(" ");
        const courseStart = course.start_time;
        const courseEnd = course.end_time;
        const courseCode = course.course_code + " " +  course.section;
        // Check if the course start time matches the available times
        for (let time in newTasks) {
          if (parseInt(courseStart.slice(0, 2)) >= parseInt(time.slice(0, 2)) && parseInt(courseEnd.slice(0, 2)) <= (parseInt(time.slice(0, 2))+1)){
            courseDay.forEach(d => {
              newTasks[time][d] = courseCode;
            })
            break
          }
        }
      });

      setTasks(newTasks); // Update tasks with the new schedule
    };

    loadSchedule();
  }, [currentSchedule, scheduleData]);

  const goToPreviousSchedule = () => {
    if (currentSchedule > 1) {
      setCurrentSchedule(currentSchedule - 1);
    }
  };

  const goToNextSchedule = () => {
    if (currentSchedule < scheduleData.length) {
      setCurrentSchedule(currentSchedule + 1);
    }
  };


  const toggleVisibility = (index, courseCode) => {
    console.log(courseCode)
    setVisibleIndex(visibleIndex === index ? null : index); // Toggle visibility for the clicked course
    setVisibleCourse(visibleIndex === index ? null : courseCode);
  };

  return (
    <div style={{justifyContent: "center"}}>
      {/* Navigation Arrows */}


      <h2 className="heading" >Schedules</h2>

      {/* Calendar Table */}
      <h2 className="schedTitle">Schedule {currentSchedule}</h2>
      <div className="cont">
        <div className="arrow">

        </div>

        <div className="arrow1">
          <div
            className="arrow aleft"
            style={{"rotate": "180deg"}}
            onClick={goToPreviousSchedule}
          >
            <div className="arrow-top"></div>
            <div className="arrow-bottom"></div>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{border: "1px solid #ccc", backgroundColor: "#00a6a6" }}>Time</th>
              {days.map((day) => (
                <th
                  key={day}
                  style={{
                    border: "1px solid #fff1b7",
                    padding: "10px",
                    textAlign: "center",
                    backgroundColor: "#00a6a6"
                  }}
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((time) => 
            (
              <tr key={time}>
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "10px",
                    textAlign: "center",
                    fontWeight: "bold",
                    backgroundColor: "#00a6a6"
                  }}
                >
                  {time}
                </td>
                {days.map((day) => 
                
                (
                  <td
                  className={tasks[time] && tasks[time][day] && visibleCourse == tasks[time][day] ? "selected" : ""}
                    key={day}
                    style={{
                      border: "1px solid #ccc",
                      padding: "10px",
                      textAlign: "center",
                    }}
                  >
                    {/* Check if the task exists for this time slot and day */}
                    {tasks[time] && tasks[time][day] ? tasks[time][day] : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="arrow1">
          <div
            className="arrow aright"
            onClick={goToNextSchedule}
          >
          <div className="arrow-top"></div>
          <div className="arrow-bottom"></div>
            
          </div>
        </div>

        {/* Classes Area */}
        <div className="classes">
          <h3 style={{"textAlign": "left", "marginLeft": "20px"}}>Classes</h3>
          <br></br>
            {scheduleData[currentSchedule - 1].courses.map((course, index) => (
              <div className="course" key={index} onClick={() => toggleVisibility(index, (course.course_code+" "+course.section))}>
                <div className={visibleIndex === index ? "courseCode selected" : "courseCode"}>{course.course_code} {course.section}</div>
                {/* {<div className="courseInfo"> */}
                {visibleIndex === index && <div className="courseInfo">
                  <p><a href={"https://calendar.carleton.ca/search/?P="+course.course_code.slice(0, 4) + "%20" + course.course_code.slice(4)} target="_blank">{course.course_title}</a></p>
                  <p><a href={"https://www.ratemyprofessors.com/search/professors?q="+course.instructor.replace(/ /g, '%20')} target="_blank">{course.instructor}</a></p>
                  <p>CRN: {course.crn}</p>
                  <p>{course.day}</p>
                  <p>{course.start_time} - {course.end_time}</p>
                </div> }
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Schedule;
