import fs from "fs";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import { readFile, writeFile } from "fs/promises";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

dotenv.config();

// ----------------------------------------------------------------------
// 1) UTILITY FUNCTIONS
// ----------------------------------------------------------------------
function normalizeCode(code) {
  return code.trim().toUpperCase().replace(/\s/g, '');
}

/**
 * Reads allowed course codes from "course_codes.txt". The file should contain
 * a comma-separated list of course codes.
 */
async function readAllowedCodes() {
  try {
    const fileContents = await readFile("course_codes.txt", "utf8");
    // Split by comma, trim each code, and filter out any empty entries.
    return fileContents
      .split(",")
      .map(code => code.trim())
      .filter(code => code.length > 0);
  } catch (err) {
    console.error("Error reading course_codes.txt:", err);
    return [];
  }
}

// ----------------------------------------------------------------------
// 2) CLASS DEFINITIONS
// ----------------------------------------------------------------------
export class CourseCode {
  constructor(courseCode) {
    this.course_code = courseCode;
  }
}

export class ScheduleCourse {
  constructor({
    status,
    crn,
    course_code,
    section,
    course_title,
    credits,
    schedule_type,
    instructor,
    day,
    start_time,
    end_time,
    also_register_in = null
  }) {
    this.status = status;
    this.crn = String(crn);
    this.course_code = course_code;
    this.section = section;
    this.course_title = course_title;
    this.credits = parseFloat(credits) || 0.0;
    this.schedule_type = schedule_type;
    this.instructor = instructor;
    this.day = day;
    this.start_time = start_time;
    this.end_time = end_time;
    this.also_register_in = also_register_in;
  }
}

// ----------------------------------------------------------------------
// 3) GET COURSE CODES FUNCTION
// ----------------------------------------------------------------------
export async function getCourseCode(
  client,
  allowedCodes,
  rawText = null,
  audioFilePath = null,
  transcriptionModel = "whisper-large-v3-turbo",
  prompt = null,
  model = "llama3-70b-8192"
) {
  const baseResponse = {
    status: "error",
    requested_input: "",
    special_request: "",
    mandatory: [],
    electives: []
  };

  let userQuery;
  if (rawText && rawText.trim()) {
    userQuery = rawText.trim();
  } else if (audioFilePath) {
    try {
      // Use a read stream in accordance with Groq documentation:
      const fileStream = fs.createReadStream(audioFilePath);
      const transcription = await client.audio.transcriptions.create({
        file: fileStream,
        model: transcriptionModel,
        prompt: prompt || "",
        language: "en",
        temperature: 0.0
      });
      userQuery = transcription.text || "";
    } catch (err) {
      if (err.message.includes("message too large")) {
        return {
          ...baseResponse,
          requested_input: "Audio file is too large. Please provide a smaller file or use raw text input."
        };
      }
      return { ...baseResponse, requested_input: `File error: ${err.message}` };
    }
  } else {
    return { ...baseResponse, requested_input: "No input provided (neither audio nor raw text)." };
  }

  if (!userQuery.trim()) {
    return { ...baseResponse, requested_input: "Input text was empty." };
  }

  const systemPrompt = `You are a course code extraction assistant. You must output JSON that matches this schema:
{
  "status": "success",
  "requested_input": "user's input text",
  "special_request": "any scheduling preferences",
  "mandatory": [{"course_code": "CODE1"}],
  "electives": [{"course_code": "CODE2"}]
}

Schema fields:
- 'mandatory': list of courses the user explicitly wants
- 'electives': list of courses the user says are optional
- 'special_request': if the user mentions any scheduling preference (e.g., 'avoid Fridays'), store it here.

If the user doesn't mention an 'elective' or 'optional' phrase, default it to 'mandatory'.

The ONLY valid course codes are:
${allowedCodes.join(", ")}

Ensure you strictly follow the JSON schema.`;

  try {
    const chatCompletion = await client.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    });
    const responseObj = JSON.parse(chatCompletion.choices[0].message.content);

    // Filter out any codes not in allowedCodes.
    responseObj.mandatory = responseObj.mandatory.filter(c => allowedCodes.includes(c.course_code));
    responseObj.electives = responseObj.electives.filter(c => allowedCodes.includes(c.course_code));

    return { ...responseObj, status: "success", requested_input: userQuery };
  } catch (err) {
    return { ...baseResponse, requested_input: userQuery };
  }
}

// ----------------------------------------------------------------------
// 4) GENERATE SCHEDULES FUNCTION
// ----------------------------------------------------------------------
export async function generateSchedules(
  client,
  mdFilePath,
  mandatoryCourses,
  electiveCourses,
  specialRequests = null,
  model = "llama3-70b-8192"
) {
  let mdContent;
  try {
    mdContent = await readFile(mdFilePath, "utf-8");
  } catch (err) {
    return {
      status: "error",
      requested_courses: {
        mandatory: mandatoryCourses.map(c => ({ course_code: c })),
        electives: electiveCourses.map(c => ({ course_code: c }))
      },
      special_requests: specialRequests,
      schedules: []
    };
  }

  const systemPrompt = `You are a scheduling assistant. You must output JSON that matches this schema:
{
  "status": "success",
  "requested_courses": {
    "mandatory": [{"course_code": "CODE1"}],
    "electives": [{"course_code": "CODE2"}]
  },
  "special_requests": "any special requests",
  "schedules": [
    {
      "schedule_id": 1,
      "courses": [{
        "status": "open",
        "crn": "12345",
        "course_code": "CODE1",
        "section": "A",
        "course_title": "Course Title",
        "credits": 1,
        "schedule_type": "lecture",
        "instructor": "Instructor Name",
        "day": "Mon",
        "start_time": "10:00",
        "end_time": "11:00",
        "also_register_in": "Optional info"
      }]
    }
  ]
}

Each course in the schedules array must include all required fields.
Ensure your JSON strictly follows the schema.`;

  const userMsg = `MANDATORY COURSES: ${mandatoryCourses.join(", ")}
ELECTIVE COURSES: ${electiveCourses.join(", ")}
SPECIAL REQUESTS: ${specialRequests || "None"}
MARKDOWN FILE CONTENT: ${mdContent}
GENERATION INSTRUCTIONS: Generate multiple course schedules (aim for at least 3) with each schedule having a maximum of 2.5 credits. For courses with tutorials, always select the tutorial corresponding to the lecture. Only output schedules that contain every mandatory course.`;

  try {
    const chatCompletion = await client.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    });
    const responseObj = JSON.parse(chatCompletion.choices[0].message.content);
    return {
      ...responseObj,
      status: "success",
      requested_courses: {
        mandatory: mandatoryCourses.map(c => ({ course_code: c })),
        electives: electiveCourses.map(c => ({ course_code: c }))
      },
      special_requests: specialRequests
    };
  } catch (err) {
    console.error("Error generating schedules:", err);
    return {
      status: "error",
      requested_courses: {
        mandatory: mandatoryCourses.map(c => ({ course_code: c })),
        electives: electiveCourses.map(c => ({ course_code: c }))
      },
      special_requests: specialRequests,
      schedules: []
    };
  }
}

// ----------------------------------------------------------------------
// 5) SCRAPER: fetchCoursesForDepartment (unchanged)
// ----------------------------------------------------------------------
export async function fetchCoursesForDepartment(department, termCode = "202510") {
  const formDataTemplate =
    "wsea_code=EXT&term_code={term_code}&session_id=22963932&ws_numb=&sel_aud=dummy&" +
    "sel_subj=dummy&sel_camp=dummy&sel_sess=dummy&sel_attr=dummy&sel_levl=dummy&" +
    "sel_schd=dummy&sel_insm=dummy&sel_link=dummy&sel_wait=dummy&sel_day=dummy&" +
    "sel_begin_hh=dummy&sel_begin_mi=dummy&sel_begin_am_pm=dummy&sel_end_hh=dummy&" +
    "sel_end_mi=dummy&sel_end_am_pm=dummy&sel_instruct=dummy&sel_special=dummy&" +
    "sel_resd=dummy&sel_breadth=dummy&sel_levl=UG&sel_subj={dept}&sel_number=&" +
    "sel_crn=&sel_special=N&sel_sess=&sel_schd=&sel_instruct=&sel_begin_hh=0&" +
    "sel_begin_mi=0&sel_begin_am_pm=a&sel_end_hh=0&sel_end_mi=0&sel_end_am_pm=a&" +
    "sel_day=m&sel_day=t&sel_day=w&sel_day=r&sel_day=f&sel_day=s&sel_day=u&block_button=";
  const formData = formDataTemplate
    .replace("{dept}", department)
    .replace("{term_code}", termCode);

  const headers = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Connection": "keep-alive",
    "Content-Type": "application/x-www-form-urlencoded",
    "Cookie": "BIGipServer~Windows-Servers~BANWEB-HTTPS-8443-POOL=...; TS0179361f=...",
    "Origin": "https://central.carleton.ca",
    "Referer": "https://central.carleton.ca/prod/bwysched.p_search_fields",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "macOS"
  };

  try {
    const response = await fetch("https://central.carleton.ca/prod/bwysched.p_course_search", {
      method: "POST",
      headers: headers,
      body: formData
    });
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const allRows = Array.from(document.querySelectorAll('tr[bgcolor="#C0C0C0"], tr[bgcolor="#DCDCDC"]'));
    const rowCount = allRows.length;
    const courses = [];
    let i = 0;

    while (i < rowCount) {
      const row = allRows[i];
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length >= 11) {
        const statusText = cells[1].textContent.trim();
        const crn = cells[2].textContent.trim();
        const courseAndNumber = cells[3].textContent.trim();
        const section = cells[4].textContent.trim();
        const courseTitle = cells[5].textContent.trim();
        const creditsText = cells[6].textContent.trim();
        const scheduleType = cells[7].textContent.trim();
        const instructor = cells[10].textContent.trim();
        let credits = parseFloat(creditsText);
        if (isNaN(credits)) credits = 0.0;
        let meetingDay = "";
        let startTime = "";
        let endTime = "";
        let alsoRegisterIn = "";

        i++;
        while (i < rowCount) {
          const nextText = allRows[i].textContent.replace(/\s+/g, " ").trim();
          const lowered = nextText.toLowerCase();
          if (lowered.includes("meeting date:")) {
            const dayMatch = nextText.match(/Days:\s*(.+?)\s*Time:/i);
            const timeMatch = nextText.match(/Time:\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/i);
            if (dayMatch) {
              meetingDay = dayMatch[1].trim();
            }
            if (timeMatch) {
              startTime = timeMatch[1];
              endTime = timeMatch[2];
            }
            i++;
            continue;
          } else if (lowered.includes("also register in:")) {
            const parts = nextText.split(/Also Register in:/i);
            if (parts.length > 1) {
              alsoRegisterIn = parts[1].trim();
            }
            i++;
            continue;
          } else if (lowered.includes("section information:")) {
            i++;
            break;
          } else {
            break;
          }
        }

        const course = new ScheduleCourse({
          status: statusText,
          crn: crn,
          course_code: courseAndNumber,
          section: section,
          course_title: courseTitle,
          credits: credits,
          schedule_type: scheduleType,
          instructor: instructor,
          day: meetingDay,
          start_time: startTime,
          end_time: endTime,
          also_register_in: alsoRegisterIn ? alsoRegisterIn : null
        });
        courses.push(course);
      } else {
        i++;
      }
    }
    return courses;
  } catch (err) {
    console.error(`Error fetching courses for ${department}:`, err);
    return [];
  }
}

// ----------------------------------------------------------------------
// 6) EXPORTED FUNCTION: generateSchedulesFromInput
// ----------------------------------------------------------------------
/*
  This function ties everything together.
  
  It accepts an options object:
  {
    rawText: <optional string>,
    audioFilePath: <optional string>
  }
  
  Raw text takes precedence if both are provided.
  It returns a JSON response that is the final schedules output.
*/
export async function generateSchedulesFromInput({ rawText = "", audioFilePath = "" } = {}) {
  // Instantiate the Groq client.
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  
  // Read allowed codes dynamically from course_codes.txt.
  const allowedCodes = await readAllowedCodes();
  if (allowedCodes.length === 0) {
    return { error: "No allowed course codes available." };
  }
  
  // 1. Get the course codes.
  const codesResponse = await getCourseCode(
    client,
    allowedCodes,
    rawText,
    audioFilePath,
    "whisper-large-v3-turbo",
    "Specify context or spelling",
    "llama3-70b-8192"
  );
  if (codesResponse.status === "error") {
    return { error: "Error extracting course codes", details: codesResponse.requested_input };
  }
  
  // 2. Extract all codes and determine the departments.
  const allCodes = [
    ...codesResponse.mandatory.map(c => c.course_code),
    ...codesResponse.electives.map(c => c.course_code)
  ];
  
  const departments = new Set();
  allCodes.forEach(code => {
    const match = code.match(/([A-Za-z]+)/);
    if (match) departments.add(match[1]);
  });
  
  // 3. Scrape courses for each department.
  let allScrapedCourses = [];
  for (const dept of departments) {
    console.log(`Fetching courses for department: ${dept}`);
    const deptCourses = await fetchCoursesForDepartment(dept);
    allScrapedCourses = allScrapedCourses.concat(deptCourses);
  }
  
  // 4. Filter out only relevant courses.
  const requestedCodesSet = new Set(allCodes.map(code => code.toUpperCase().replace(/\s/g, '')));
  const relevantCourses = allScrapedCourses.filter(c => {
    const normalizedScraped = c.course_code.toUpperCase().replace(/\s/g, '');
    return requestedCodesSet.has(normalizedScraped);
  });
  
  // 5. Write the relevant courses to a markdown file.
  const outputFile = "scraped_courses.md";
  let mdContent = "# Course List\n\n";
  relevantCourses.forEach(c => {
    mdContent += `## ${c.course_code} (Section ${c.section})\n\n`;
    mdContent += `- **CRN**: ${c.crn}\n`;
    mdContent += `- **Title**: ${c.course_title}\n`;
    mdContent += `- **Status**: ${c.status}\n`;
    mdContent += `- **Credits**: ${c.credits}\n`;
    mdContent += `- **Schedule Type**: ${c.schedule_type}\n`;
    mdContent += `- **Instructor**: ${c.instructor}\n`;
    mdContent += `- **Days**: ${c.day}\n`;
    mdContent += `- **Time**: ${c.start_time} - ${c.end_time}\n`;
    if (c.also_register_in) {
      mdContent += `- **Also Register in**: ${c.also_register_in}\n`;
    }
    mdContent += "\n---\n\n";
  });
  await writeFile(outputFile, mdContent, { encoding: "utf-8" });
  console.log(`Wrote ${relevantCourses.length} relevant courses to ${outputFile}`);
  
  // 6. Generate schedules using the markdown file.
  const mandatoryList = codesResponse.mandatory.map(c => c.course_code);
  const electiveList = codesResponse.electives.map(c => c.course_code);
  const schedulesResponse = await generateSchedules(
    client,
    outputFile,
    mandatoryList,
    electiveList,
    codesResponse.special_request,
    "llama3-70b-8192"
  );
  
  return schedulesResponse;
}

// ----------------------------------------------------------------------
// MAIN USAGE (runs when the file is executed directly)
// ----------------------------------------------------------------------
async function main() {
  const result = await generateSchedulesFromInput({
    rawText: "I want to mandatory register COMP1405, COMP1805, MATH1007, BIOL1902, PSYC1001"
    // To test with an audio file, set:
    // audioFilePath: "path/to/your_audio_file.m4a"
  });
  console.log("\n--- FINAL SCHEDULES RESPONSE ---");
  console.log(JSON.stringify(result, null, 2));
}

// Run main() only if this module is executed directly.
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}