import fetch from "node-fetch";
import { JSDOM } from "jsdom";

// Utility: Normalize a course code (remove spaces and uppercase)
function normalizeCode(code) {
  return code.trim().toUpperCase().replace(/\s/g, '');
}

// Function to scrape courses for a given department
async function fetchCoursesForDepartment(department, termCode = "202510") {
  // This form-data template mimics the one used by the Carleton scheduler.
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

  // Minimal headers (add more if needed)
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

    // Select rows with the relevant background colors.
    const allRows = Array.from(
      document.querySelectorAll('tr[bgcolor="#C0C0C0"], tr[bgcolor="#DCDCDC"]')
    );
    const courseCodes = [];

    // For each row, if it has at least 11 cells then extract the text in cell index 3.
    for (const row of allRows) {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length >= 11) {
        // Assume the fourth cell (index 3) contains the course code (e.g., "COMP1405")
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

// Function that iterates through a list of departments, collects course codes,
// removes duplicates, sorts them, and returns the final array.
async function listAllCourseCodes() {
  // Define an array of department prefixes.
  // Add or remove as needed.
  const departments = [
    "COMP", "BUSI", "MATH", "BIOL", "PSYC", "ENGL", "HIST", "CHEM", "PHYS", "ECON"
  ];

  const allCourseCodesSet = new Set();

  for (const dept of departments) {
    console.log(`Fetching courses for department: ${dept}`);
    const codes = await fetchCoursesForDepartment(dept);
    codes.forEach(code => {
      // Normalize each course code before adding to the set.
      allCourseCodesSet.add(normalizeCode(code));
    });
  }

  // Convert the set to an array and sort it lexically.
  const allCourseCodes = Array.from(allCourseCodesSet);
  allCourseCodes.sort();
  return allCourseCodes;
}

// Main execution: call listAllCourseCodes() and print each code.
async function main() {
  const codes = await listAllCourseCodes();
  console.log("All Carleton Course Codes:");
  codes.forEach(code => console.log(code));
}

main().catch(err => console.error("Error in main:", err));
