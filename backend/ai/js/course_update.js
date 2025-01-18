import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { writeFile } from "fs/promises";

// ----------------------------------------------------------------------------
// 1) UTILITY FUNCTIONS
// ----------------------------------------------------------------------------
function normalizeCode(code) {
  return code.trim().toUpperCase().replace(/\s/g, '');
}

/**
 * Given an HTML string representing the subject dropdown,
 * this function returns an array of department codes.
 */
function getDepartmentCodesFromHTML(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const select = document.querySelector("select[name='sel_subj']");
  if (!select) {
    throw new Error("Unable to locate the 'sel_subj' dropdown in provided HTML.");
  }
  // Get all option values except the first one ("All Subjects")
  const options = Array.from(select.querySelectorAll("option"))
    .filter(opt => opt.value && opt.value.trim() !== "")
    .map(opt => opt.value.trim());
  return options;
}

// ----------------------------------------------------------------------------
// 2) FETCH COURSES FOR A GIVEN DEPARTMENT
// ----------------------------------------------------------------------------
async function fetchCoursesForDepartment(department, termCode = "202510") {
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

  // Minimal headers (adjust if necessary)
  const headers = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Content-Type": "application/x-www-form-urlencoded"
  };

  try {
    const response = await fetch(
      "https://central.carleton.ca/prod/bwysched.p_course_search",
      {
        method: "POST",
        headers: headers,
        body: formData
      }
    );
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Select rows with bgcolor matching "#C0C0C0" or "#DCDCDC"
    const allRows = Array.from(
      document.querySelectorAll('tr[bgcolor="#C0C0C0"], tr[bgcolor="#DCDCDC"]')
    );
    const courseCodes = [];
    for (const row of allRows) {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length >= 11) {
        // Assume that the fourth cell (index 3) contains the course code
        const courseAndNumber = cells[3].textContent.trim();
        courseCodes.push(courseAndNumber);
      }
    }
    return courseCodes;
  } catch (err) {
    console.error(`Error fetching courses for ${department}:`, err);
    return [];
  }
}

// ----------------------------------------------------------------------------
// 3) LIST ALL COURSE CODES DYNAMICALLY
// ----------------------------------------------------------------------------
async function listAllCourseCodes() {
  // The provided HTML snippet containing the subject dropdown.
  const htmlSnippet = `<select name="sel_subj" id="subj_id" size="6" multiple="">
<option value="" selected="">All Subjects</option>
<option value="AERO">Aerospace Engineering (AERO)</option>
<option value="AFRI">African Studies (AFRI)</option>
<option value="ASLA">American Sign Language (ASLA)</option>
<option value="ANTH">Anthropology (ANTH)</option>
<option value="ALDS">Appl. Linguistics &amp; Discourse (ALDS)</option>
<option value="ACSE">Arch Conserv &amp; Sustainabil Eng (ACSE)</option>
<option value="ARCY">Archaeology (ARCY)</option>
<option value="ARCS">Architecture - Studio (ARCS)</option>
<option value="ARCC">Architecture - Technical (ARCC)</option>
<option value="ARCN">Architecture - Techniques (ARCN)</option>
<option value="ARCH">Architecture - Theory/History (ARCH)</option>
<option value="ARCU">Architecture - Urban (ARCU)</option>
<option value="ARTH">Art History (ARTH)</option>
<option value="BIOC">Biochemistry (BIOC)</option>
<option value="BIOL">Biology (BIOL)</option>
<option value="BUSI">Business (BUSI)</option>
<option value="CDNS">Canadian Studies (CDNS)</option>
<option value="CIED">Centre for Initiatives in Edu (CIED)</option>
<option value="CHEM">Chemistry (CHEM)</option>
<option value="CHST">Childhood and Youth Studies (CHST)</option>
<option value="CHIN">Chinese (CHIN)</option>
<option value="CIVE">Civil Engineering (CIVE)</option>
<option value="CLCV">Classical Civilization (CLCV)</option>
<option value="COOP">Co-op (COOP)</option>
<option value="CGSC">Cognitive Science (CGSC)</option>
<option value="CCDP">Comm. Crses Discipline &amp; Prof. (CCDP)</option>
<option value="COMS">Communication &amp; Media Studies (COMS)</option>
<option value="COMP">Computer Science (COMP)</option>
<option value="CRCJ">Criminology and Crim Just (CRCJ)</option>
<option value="CRST">Critical Race Studies (CRST)</option>
<option value="DIGH">Digital Humanities (DIGH)</option>
<option value="DBST">Disability Studies (DBST)</option>
<option value="ESPW">ESP Workshop (ESPW)</option>
<option value="ERTH">Earth Sciences (ERTH)</option>
<option value="ECON">Economics (ECON)</option>
<option value="ELEC">Electronics (ELEC)</option>
<option value="ECOR">Engineering Core (ECOR)</option>
<option value="ENGL">English (ENGL)</option>
<option value="ESLA">English as a Second Language (ESLA)</option>
<option value="EACH">Environ. &amp; Climate Humanities (EACH)</option>
<option value="ENVE">Environmental Engineering (ENVE)</option>
<option value="ENSC">Environmental Science (ENSC)</option>
<option value="ENST">Environmental Studies (ENST)</option>
<option value="EURR">European and Russian Studies (EURR)</option>
<option value="FILM">Film Studies (FILM)</option>
<option value="FYSM">First Year Seminar (FYSM)</option>
<option value="FOOD">Food Science (FOOD)</option>
<option value="FREN">French (FREN)</option>
<option value="FINS">French Interdiscip. Studies (FINS)</option>
<option value="GEOG">Geography (GEOG)</option>
<option value="GEOM">Geomatics (GEOM)</option>
<option value="GERM">German (GERM)</option>
<option value="GPOL">Global Politics (GPOL)</option>
<option value="GINS">Global and Inter. Studies (GINS)</option>
<option value="GREK">Greek (GREK)</option>
<option value="HLTH">Health (HLTH)</option>
<option value="HIST">History (HIST)</option>
<option value="HRSJ">Human Rights &amp; Social Justice (HRSJ)</option>
<option value="HUMS">Humanities (HUMS)</option>
<option value="IESP">Indigenous Enriched Support (IESP)</option>
<option value="INDG">Indigenous Studies (INDG)</option>
<option value="IDES">Industrial Design (IDES)</option>
<option value="IRM">Information Resource Mgmt (IRM)</option>
<option value="BIT">Information Technology (BIT)</option>
<option value="ITEC">Information Technology (ITEC)</option>
<option value="INSC">Integrated Science (INSC)</option>
<option value="IMD">Inter. Multi Media &amp; Design (IMD)</option>
<option value="ISAP">Interdis. Science and Practice (ISAP)</option>
<option value="IPAF">Interdisc. Public Affairs (IPAF)</option>
<option value="INAF">International Affairs (INAF)</option>
<option value="ITAL">Italian (ITAL)</option>
<option value="JAPA">Japanese (JAPA)</option>
<option value="JOUR">Journalism (JOUR)</option>
<option value="KORE">Korean (KORE)</option>
<option value="LATN">Latin (LATN)</option>
<option value="LACS">Latin American &amp; Caribbean (LACS)</option>
<option value="LAWS">Law (LAWS)</option>
<option value="LING">Linguistics (LING)</option>
<option value="MATH">Mathematics (MATH)</option>
<option value="MECH">Mechanical Engineering (MECH)</option>
<option value="MAAE">Mechanical and Aero Engineer (MAAE)</option>
<option value="MPAD">Media Production and Design (MPAD)</option>
<option value="MEMS">Medieval &amp;Early Modern Studies (MEMS)</option>
<option value="MUSI">Music (MUSI)</option>
<option value="NSCI">Natural Science (NSCI)</option>
<option value="NET">Network Technology (NET)</option>
<option value="NEUR">Neuroscience (NEUR)</option>
<option value="OSS">Optical Systems and Sensors (OSS)</option>
<option value="PHIL">Philosophy (PHIL)</option>
<option value="PHYS">Physics (PHYS)</option>
<option value="POLM">Political Management (POLM)</option>
<option value="PSCI">Political Science (PSCI)</option>
<option value="PSYC">Psychology (PSYC)</option>
<option value="PADM">Public Administration (PADM)</option>
<option value="PAPM">Public Affairs and Policy Mngm (PAPM)</option>
<option value="RELI">Religion (RELI)</option>
<option value="RUSS">Russian (RUSS)</option>
<option value="SXST">Sexuality Studies (SXST)</option>
<option value="SOWK">Social Work (SOWK)</option>
<option value="SOCI">Sociology (SOCI)</option>
<option value="SPAN">Spanish (SPAN)</option>
<option value="STAT">Statistics (STAT)</option>
<option value="SREE">Sustainable &amp; Renewable Energy (SREE)</option>
<option value="SYSC">Systems and Computer Engin (SYSC)</option>
<option value="TSES">Tech, Soc, Env (Multidiscip) (TSES)</option>
<option value="WGST">Women's and Gender Studies (WGST)</option>
</select>`;

  // Get the department codes from the provided HTML.
  const deptCodes = getDepartmentCodesFromHTML(htmlSnippet);
  console.log("Dynamically extracted department codes:", deptCodes);

  const allCourseCodesSet = new Set();
  // For each department, scrape course codes.
  for (const dept of deptCodes) {
    console.log(`Fetching courses for department: ${dept}`);
    const codes = await fetchCoursesForDepartment(dept);
    codes.forEach(code => {
      allCourseCodesSet.add(normalizeCode(code));
    });
  }
  const allCourseCodes = Array.from(allCourseCodesSet);
  allCourseCodes.sort();
  return allCourseCodes;
}

// ----------------------------------------------------------------------------
// 4) MAIN EXECUTION: Write all course codes to a .txt file, separated by commas.
// ----------------------------------------------------------------------------
async function main() {
  try {
    const courseCodes = await listAllCourseCodes();
    const data = courseCodes.join(", ");
    await writeFile("course_codes.txt", data, "utf8");
    console.log("Course codes written to course_codes.txt");
  } catch (err) {
    console.error("Error in main:", err);
  }
}

main().catch(err => console.error("Error:", err));









// import fetch from "node-fetch";
// import { JSDOM } from "jsdom";

// // Utility: Normalize a course code (remove spaces and uppercase)
// function normalizeCode(code) {
//   return code.trim().toUpperCase().replace(/\s/g, '');
// }

// // Function to scrape courses for a given department
// async function fetchCoursesForDepartment(department, termCode = "202510") {
//   // This form-data template mimics the one used by the Carleton scheduler.
//   const formDataTemplate =
//     "wsea_code=EXT&term_code={term_code}&session_id=22963932&ws_numb=&sel_aud=dummy&" +
//     "sel_subj=dummy&sel_camp=dummy&sel_sess=dummy&sel_attr=dummy&sel_levl=dummy&" +
//     "sel_schd=dummy&sel_insm=dummy&sel_link=dummy&sel_wait=dummy&sel_day=dummy&" +
//     "sel_begin_hh=dummy&sel_begin_mi=dummy&sel_begin_am_pm=dummy&sel_end_hh=dummy&" +
//     "sel_end_mi=dummy&sel_end_am_pm=dummy&sel_instruct=dummy&sel_special=dummy&" +
//     "sel_resd=dummy&sel_breadth=dummy&sel_levl=UG&sel_subj={dept}&sel_number=&" +
//     "sel_crn=&sel_special=N&sel_sess=&sel_schd=&sel_instruct=&sel_begin_hh=0&" +
//     "sel_begin_mi=0&sel_begin_am_pm=a&sel_end_hh=0&sel_end_mi=0&sel_end_am_pm=a&" +
//     "sel_day=m&sel_day=t&sel_day=w&sel_day=r&sel_day=f&sel_day=s&sel_day=u&block_button=";
//   const formData = formDataTemplate
//     .replace("{dept}", department)
//     .replace("{term_code}", termCode);

//   // Minimal headers (add more if needed)
//   const headers = {
//     "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
//     "Content-Type": "application/x-www-form-urlencoded"
//   };

//   try {
//     const response = await fetch(
//       "https://central.carleton.ca/prod/bwysched.p_course_search",
//       {
//         method: "POST",
//         headers: headers,
//         body: formData
//       }
//     );
//     if (!response.ok) throw new Error(`Status: ${response.status}`);
//     const html = await response.text();
//     const dom = new JSDOM(html);
//     const document = dom.window.document;

//     // Select rows with the relevant background colors.
//     const allRows = Array.from(
//       document.querySelectorAll('tr[bgcolor="#C0C0C0"], tr[bgcolor="#DCDCDC"]')
//     );
//     const courseCodes = [];

//     // For each row, if it has at least 11 cells then extract the text in cell index 3.
//     for (const row of allRows) {
//       const cells = Array.from(row.querySelectorAll("td"));
//       if (cells.length >= 11) {
//         // Assume the fourth cell (index 3) contains the course code (e.g., "COMP1405")
//         const courseAndNumber = cells[3].textContent.trim();
//         courseCodes.push(courseAndNumber);
//       }
//     }
//     return courseCodes;
//   } catch (err) {
//     console.error(`Error fetching courses for ${department}:`, err);
//     return [];
//   }
// }

// // Function that iterates through a list of departments, collects course codes,
// // removes duplicates, sorts them, and returns the final array.
// async function listAllCourseCodes() {
//   // Define an array of department prefixes.
//   // Add or remove as needed.
//   const departments = [
//     "COMP", "BUSI", "MATH", "BIOL", "PSYC", "ENGL", "HIST", "CHEM", "PHYS", "ECON"
//   ];

//   const allCourseCodesSet = new Set();

//   for (const dept of departments) {
//     console.log(`Fetching courses for department: ${dept}`);
//     const codes = await fetchCoursesForDepartment(dept);
//     codes.forEach(code => {
//       // Normalize each course code before adding to the set.
//       allCourseCodesSet.add(normalizeCode(code));
//     });
//   }

//   // Convert the set to an array and sort it lexically.
//   const allCourseCodes = Array.from(allCourseCodesSet);
//   allCourseCodes.sort();
//   return allCourseCodes;
// }

// // Main execution: call listAllCourseCodes() and print each code.
// async function main() {
//   const codes = await listAllCourseCodes();
//   console.log("All Carleton Course Codes:");
//   codes.forEach(code => console.log(code));
// }

// main().catch(err => console.error("Error in main:", err));
