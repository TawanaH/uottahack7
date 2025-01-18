import React, { useState, useEffect } from "react";
import "../components/App.css"
const Schedule = () => {
  const times = [
    "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
  ];

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  // Example of how the response data might look
  const scheduleResponse = {
    status: "success",
    requested_courses: {
      mandatory: [
        { course_code: "COMP1405" },
        { course_code: "COMP1406" },
        {course_code : "1805"}
      ],
      electives: []
    },
    special_requests: "no class on a Monday",
    schedules: [
      {
        schedule_id: 1,
        courses: [
          {
            course_code: "COMP1405",
            section: "A",
            course_title: "Introduction to Programming",
            instructor: "Dr. Jane Smith",
            day: "Wednesday",
            start_time: "08:30",
            end_time: "10:00"
          },
          {
            course_code: "COMP1406",
            section: "A",
            course_title: "Foundations of Programming",
            instructor: "Dr. Helen Clark",
            day: "Tuesday",
            start_time: "08:00",
            end_time: "09:30"
          },
        ]
      },
      {
        schedule_id: 2,
        courses: [
          {
            course_code: "COMP1405",
            section: "A1",
            course_title: "Introduction to Programming",
            instructor: "Bob Brown",
            day: "Wednesday",
            start_time: "16:00",
            end_time: "17:30"
          },
          {
            course_code: "COMP1406",
            section: "B",
            course_title: "Foundations of Programming",
            instructor: "Prof. Gina Mendez",
            day: "Wednesday",
            start_time: "14:00",
            end_time: "15:30"
          },
        ]
      }
    ]
  };

  const [tasks, setTasks] = useState(
    times.reduce((acc, time) => {
      acc[time] = {}; // Initialize tasks for each time slot
      return acc;
    }, {})
  );

  const [currentSchedule, setCurrentSchedule] = useState(1);
  const [scheduleData, setScheduleData] = useState(scheduleResponse.schedules);

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
        const courseDay = course.day;
        const courseTime = course.start_time;
        const courseTitle = course.course_title;

        // Check if the course start time matches the available times
        if (newTasks[courseTime]) {
          newTasks[courseTime][courseDay] = courseTitle;
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

  return (
    <div style={{ position: "relative", display: "flex", justifyContent: "center"}}>
      {/* Navigation Arrows */}
      <div
        className="arrow"
        style={{
          left: "20px"
        }}
        onClick={goToPreviousSchedule}
      >
        <div className="arrow-top"></div>
        <div className="arrow-bottom"></div>
      </div>

      <div
         className="arrow arrow-left"
        style={{
         right: "20px"
        }}
        onClick={goToNextSchedule}
      >
      <div className="arrow-top"></div>
      <div className="arrow-bottom"></div>
        
      </div>

      {/* Calendar Table */}
      <div style={{ width: "70%", marginRight: "20px" }}>
        <h2 style={{ textAlign: "center" }}>Schedule {currentSchedule}</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ width: "150px", border: "1px solid #ccc", padding: "10px", backgroundColor: "#00a6a6" }}>Time</th>
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
            {times.map((time) => (
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
                {days.map((day) => (
                  <td
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
      </div>

      {/* Classes Area */}
      <div style={{ width: "25%", borderLeft: "px solid #ccc", padding: "20px" }}>
        <h3>Classes Information</h3>
        <ul>
          {scheduleData[currentSchedule - 1].courses.map((course, index) => (
            <li key={index}>
              {course.course_code} - {course.course_title} ({course.instructor}) - {course.day} {course.start_time} - {course.end_time}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Schedule;
