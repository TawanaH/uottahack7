import os
import json
import re
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from typing import List, Optional
from pydantic import BaseModel
# For Pydantic v2 you can import field_validator:
from pydantic import field_validator
from groq import Groq

# ----------------------------------------------------------------------
# 1) SCHEMA FOR GET_COURSE_CODES
# ----------------------------------------------------------------------
class CourseCode(BaseModel):
    """
    Represents a single course code.
    """
    course_code: str

class GetCourseCodesResponse(BaseModel):
    """
    JSON response schema for get_course_codes.

    We split recognized codes into two lists:
    - mandatory
    - electives

    If unspecified, codes go into mandatory.
    'special_request' captures additional scheduling requirements
    (e.g., "no classes on Friday").
    """
    status: str               # "success" or "error"
    requested_input: str      # The transcribed user speech or raw text
    special_request: str      # The user's special request
    mandatory: List[CourseCode] = []
    electives: List[CourseCode] = []

# ----------------------------------------------------------------------
# 2) SCHEMA FOR GENERATE_SCHEDULES
# ----------------------------------------------------------------------
class ScheduleCourse(BaseModel):
    """
    Represents a single class’s schedule information.
    """
    status: str               # e.g. "open", "registration closed"
    crn: str                  # random numeric identifier; we force it to be a string
    course_code: str
    section: str              # e.g. "A", "B"
    course_title: str         # e.g. "Intro to Programming"
    credits: float            # e.g. 0, 0.5, or 1
    schedule_type: str        # "lecture" or "tutorial"
    instructor: str           # e.g. "Jane Smith"
    day: str
    start_time: str
    end_time: str
    also_register_in: Optional[str] = None   # NEW FIELD: extra registration options

    # This validator will convert a numeric crn into a string before validation.
    @field_validator('crn', mode='before')
    def coerce_crn_to_str(cls, v):
        return str(v)

class SingleSchedule(BaseModel):
    """
    Represents one complete schedule option.
    """
    schedule_id: int
    courses: List[ScheduleCourse] = []

class RequestedCourses(BaseModel):
    """
    Stores mandatory/elective courses inside a sub-model.
    """
    mandatory: List[CourseCode] = []
    electives: List[CourseCode] = []

class GenerateSchedulesResponse(BaseModel):
    """
    JSON response schema for generate_schedules.
    """
    status: str                 # "success" or "error"
    requested_courses: RequestedCourses
    special_requests: Optional[str]
    schedules: List[SingleSchedule] = []

# ----------------------------------------------------------------------
# 3) GET_COURSE_CODES FUNCTION (audio OR raw text)
# ----------------------------------------------------------------------
def get_course_codes(
    client: Groq,
    allowed_codes: List[str],
    audio_file_path: Optional[str] = None,
    raw_text: Optional[str] = None,
    transcription_model: str = "whisper-large-v3-turbo",
    prompt: Optional[str] = None,
    model: str = "llama3-70b-8192",
) -> GetCourseCodesResponse:
    """
    Uses an audio file if provided; otherwise uses raw text.
    1) If raw_text is supplied, we skip transcription.
       Otherwise, we attempt to transcribe the given audio file.
    2) Uses a chat completion in JSON mode to return a GetCourseCodesResponse
       splitting recognized codes into 'mandatory' or 'electives'. If not specified,
       default them to 'mandatory'.
    3) The 'allowed_codes' restricts recognized courses to a predefined set.
    4) Also extracts a 'special_request' from the user's input if present.
    """
    # Determine the user query.
    if raw_text is not None and raw_text.strip():
        user_query = raw_text.strip()
    elif audio_file_path is not None:
        try:
            with open(audio_file_path, "rb") as audio_file:
                transcription = client.audio.transcriptions.create(
                    file=(audio_file_path, audio_file.read()),
                    model=transcription_model,
                    prompt=prompt or "",
                    language="en",
                    temperature=0.0
                )
            user_query = transcription.text or ""
        except FileNotFoundError:
            return GetCourseCodesResponse(
                status="error",
                requested_input=f"File not found: {audio_file_path}",
                special_request="",
                mandatory=[],
                electives=[]
            )
        except Exception as e:
            return GetCourseCodesResponse(
                status="error",
                requested_input=str(e),
                special_request="",
                mandatory=[],
                electives=[]
            )
    else:
        return GetCourseCodesResponse(
            status="error",
            requested_input="No input provided (neither audio nor raw text).",
            special_request="",
            mandatory=[],
            electives=[]
        )

    if not user_query.strip():
        return GetCourseCodesResponse(
            status="error",
            requested_input="Input text was empty.",
            special_request="",
            mandatory=[],
            electives=[]
        )

    schema_text = json.dumps(GetCourseCodesResponse.model_json_schema(), indent=2)
    system_prompt = (
        "You are a course code extraction assistant. You must output JSON that "
        "matches this schema:\n\n"
        f"{schema_text}\n\n"
        "Schema fields:\n"
        "- 'mandatory': list of courses the user explicitly wants\n"
        "- 'electives': list of courses the user says are optional\n"
        "- 'special_request': if the user mentions any scheduling preference (e.g., 'avoid Fridays'), "
        "store it here.\n"
        "\nIf the user doesn't mention an 'elective' or 'optional' phrase, default it to 'mandatory'.\n\n"
        "The ONLY valid course codes are listed below. If the user mentions codes not in this list, ignore them:\n"
        f"Allowed codes: {allowed_codes}\n\n"
        "Ensure you strictly follow the JSON schema."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_query},
    ]

    try:
        chat_completion = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0,
            stream=False,
            response_format={"type": "json_object"},
        )
        parsed_response = GetCourseCodesResponse.model_validate_json(
            chat_completion.choices[0].message.content
        )

        # Filter out any codes not in allowed_codes.
        filtered_mandatory = [
            c for c in parsed_response.mandatory if c.course_code in allowed_codes
        ]
        filtered_electives = [
            c for c in parsed_response.electives if c.course_code in allowed_codes
        ]

        parsed_response.mandatory = filtered_mandatory
        parsed_response.electives = filtered_electives
        parsed_response.status = "success"
        parsed_response.requested_input = user_query

        return parsed_response

    except Exception as e:
        return GetCourseCodesResponse(
            status="error",
            requested_input=user_query,
            special_request="",
            mandatory=[],
            electives=[]
        )

# ----------------------------------------------------------------------
# 4) GENERATE SCHEDULES FUNCTION
# ----------------------------------------------------------------------
def generate_schedules(
    client: Groq,
    md_file_path: str,
    mandatory_courses: List[str],
    elective_courses: List[str],
    special_requests: Optional[str] = None,
    model: str = "llama3-70b-8192",
) -> GenerateSchedulesResponse:
    """
    Generates possible schedules based on:
    - a Markdown file (describing class times; created by the scraper)
    - lists of mandatory/elective courses and any special constraints.
    
    Uses chat completion in JSON mode to return a GenerateSchedulesResponse.
    """
    try:
        with open(md_file_path, "r", encoding="utf-8") as f:
            md_content = f.read()
    except FileNotFoundError:
        return GenerateSchedulesResponse(
            status="error",
            requested_courses=RequestedCourses(
                mandatory=[CourseCode(course_code=c) for c in mandatory_courses],
                electives=[CourseCode(course_code=c) for c in elective_courses],
            ),
            special_requests=special_requests,
            schedules=[]
        )

    schema_text = json.dumps(GenerateSchedulesResponse.model_json_schema(), indent=2)
    system_prompt = (
        "You are a scheduling assistant. You must output JSON that matches this schema:\n\n"
        f"{schema_text}\n\n"
        "Each course in the schedules array must include:\n"
        "- status (open or registration closed)\n"
        "- crn (random numeric ID as a string)\n"
        "- course_code\n"
        "- section (e.g., A, B)\n"
        "- course_title\n"
        "- credits (e.g. 0, 0.5, or 1)\n"
        "- schedule_type (lecture or tutorial)\n"
        "- instructor (random name)\n"
        "- day\n"
        "- start_time\n"
        "- end_time\n"
        "- also_register_in (any additional registration options if provided; otherwise it can be empty)\n\n"
        "Ensure your JSON strictly follows the schema."
    )

    user_msg = (
        f"MANDATORY COURSES: {mandatory_courses}, "
        f"ELECTIVE COURSES: {elective_courses}, "
        f"SPECIAL REQUESTS: {special_requests or 'None'}, "
        f"MARKDOWN FILE CONTENT: {md_content}, "
        f"GENERATION INSTRUCTIONS: Generate multiple course schedules (aim for atleast 3) (each with a maximum of 2.5 credits) from the provided course list. For courses with tutorials, always select the tutorial that corresponds to the chosen lecture section, and only register for a tutorial if its parent lecture is included in the schedule. You cannot register for two tutorials for the same class. You must only output scheduels that contain every mandatory course."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_msg},
    ]

    try:
        chat_completion = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0,
            stream=False,
            response_format={"type": "json_object"},
        )

        parsed = GenerateSchedulesResponse.model_validate_json(
            chat_completion.choices[0].message.content
        )

        parsed.status = "success"
        parsed.requested_courses = RequestedCourses(
            mandatory=[CourseCode(course_code=c) for c in mandatory_courses],
            electives=[CourseCode(course_code=c) for c in elective_courses],
        )
        parsed.special_requests = special_requests

        return parsed

    except Exception as e:
        return GenerateSchedulesResponse(
            status="error",
            requested_courses=RequestedCourses(
                mandatory=[CourseCode(course_code=c) for c in mandatory_courses],
                electives=[CourseCode(course_code=c) for c in elective_courses],
            ),
            special_requests=special_requests,
            schedules=[]
        )

# ----------------------------------------------------------------------
# 5) SCRAPER: fetch_courses_for_department
# ----------------------------------------------------------------------
def fetch_courses_for_department(department: str, term_code: str = "202510") -> List[ScheduleCourse]:
    """
    Makes a POST request for a given department code,
    parses the returned HTML, and returns a list of ScheduleCourse objects.
    """
    form_data_template = (
        "wsea_code=EXT&term_code={term_code}&session_id=22963932&ws_numb=&sel_aud=dummy&"
        "sel_subj=dummy&sel_camp=dummy&sel_sess=dummy&sel_attr=dummy&sel_levl=dummy&"
        "sel_schd=dummy&sel_insm=dummy&sel_link=dummy&sel_wait=dummy&sel_day=dummy&"
        "sel_begin_hh=dummy&sel_begin_mi=dummy&sel_begin_am_pm=dummy&sel_end_hh=dummy&"
        "sel_end_mi=dummy&sel_end_am_pm=dummy&sel_instruct=dummy&sel_special=dummy&"
        "sel_resd=dummy&sel_breadth=dummy&sel_levl=UG&sel_subj={dept}&sel_number=&"
        "sel_crn=&sel_special=N&sel_sess=&sel_schd=&sel_instruct=&sel_begin_hh=0&"
        "sel_begin_mi=0&sel_begin_am_pm=a&sel_end_hh=0&sel_end_mi=0&sel_end_am_pm=a&"
        "sel_day=m&sel_day=t&sel_day=w&sel_day=r&sel_day=f&sel_day=s&sel_day=u&block_button="
    )
    form_data = form_data_template.format(dept=department, term_code=term_code)

    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,"
                  "image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
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
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        ),
        "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "macOS",
    }

    response = requests.post(
        "https://central.carleton.ca/prod/bwysched.p_course_search",
        headers=headers,
        data=form_data
    )
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    courses = []

    all_rows = soup.find_all("tr", bgcolor=["#C0C0C0", "#DCDCDC"])
    row_count = len(all_rows)
    i = 0

    while i < row_count:
        row = all_rows[i]
        tds = row.find_all("td", recursive=False)

        if len(tds) >= 11:
            status_text = tds[1].get_text(strip=True)
            crn = tds[2].get_text(strip=True)
            course_and_number = tds[3].get_text(strip=True)
            section = tds[4].get_text(strip=True)
            course_title = tds[5].get_text(strip=True)
            credits_text = tds[6].get_text(strip=True)
            schedule_type = tds[7].get_text(strip=True)
            instructor = tds[10].get_text(strip=True)

            try:
                credits = float(credits_text)
            except ValueError:
                credits = 0.0

            # Initialize fields that may come from subsequent rows.
            meeting_day = ""
            start_time = ""
            end_time = ""
            also_register_in = ""

            # Process subsequent rows that belong to the same course entry.
            i += 1
            while i < row_count:
                next_text = all_rows[i].get_text(separator=" ", strip=True)
                lowered = next_text.lower()
                if "meeting date:" in lowered:
                    # Extract day and time info.
                    day_match = re.search(r"Days:\s*(.+?)\s*Time:", next_text)
                    time_match = re.search(r"Time:\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})", next_text)
                    if day_match:
                        meeting_day = day_match.group(1).strip()
                    if time_match:
                        start_time = time_match.group(1)
                        end_time = time_match.group(2)
                    i += 1
                    continue
                elif "also register in:" in lowered:
                    # Extract additional registration info.
                    parts = re.split(r"Also Register in:", next_text, flags=re.IGNORECASE)
                    if len(parts) > 1:
                        also_register_in = parts[1].strip()
                    i += 1
                    continue
                elif "section information:" in lowered:
                    # Do not capture section information for now; skip it and break.
                    i += 1
                    break
                else:
                    break

            # Now create a ScheduleCourse with all the captured data.
            course = ScheduleCourse(
                status=status_text,
                crn=crn,
                course_code=course_and_number,
                section=section,
                course_title=course_title,
                credits=credits,
                schedule_type=schedule_type,
                instructor=instructor,
                day=meeting_day,
                start_time=start_time,
                end_time=end_time,
                also_register_in=also_register_in if also_register_in else None
            )
            courses.append(course)
        else:
            i += 1

    return courses

# ----------------------------------------------------------------------
# 6) MAIN USAGE: Combining all functionality
# ----------------------------------------------------------------------
if __name__ == "__main__":
    load_dotenv()
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    # Define valid course codes.
    valid_codes = [
        "COMP1405", "COMP1805", "COMP2804", "COMP1406",
        "BUSI1001", "BUSI2001", "BUSI2002", "BUSI3001", 
        "MATH1007", "BIOL1902", "PSYC1001"
    ]

    # ------------------------------------------------------------------
    # (A) GET COURSE CODES (prefer audio if provided, else use raw text)
    # ------------------------------------------------------------------
    # audio_file_path = "test3.m4a"
    audio_file_path = ""
    raw_text_input = "I want to mandatory register COMP 1405, COMP 1805, MATH 1007, BIOL1902, PSYC1001"

    codes_response = get_course_codes(
        client=client,
        allowed_codes=valid_codes,
        audio_file_path=audio_file_path,  # Will use raw text since this is empty.
        raw_text=raw_text_input,
        transcription_model="whisper-large-v3-turbo",
        prompt="Clarify domain-specific terms if needed.",
        model="llama-3.1-8b-instant"
    )

    print("\n--- GET COURSE CODES RESPONSE ---")
    print(codes_response.model_dump_json(indent=2))
    if codes_response.status == "error":
        print("Error extracting course codes; exiting.")
        exit(1)

    # ------------------------------------------------------------------
    # (B) SCRAPE COURSES FROM DEPARTMENTS
    # ------------------------------------------------------------------
    # Gather all the recognized mandatory & elective codes
    all_codes = (
        [c.course_code for c in codes_response.mandatory] +
        [c.course_code for c in codes_response.electives]
    )

    # Extract department prefixes (e.g., from "COMP1405" → "COMP")
    departments = set()
    for code in all_codes:
        match = re.match(r"([A-Za-z]+)", code)
        if match:
            departments.add(match.group(1))

    # Scrape everything from relevant departments
    all_scraped_courses = []
    for dept in departments:
        print(f"Fetching courses for department: {dept}")
        dept_courses = fetch_courses_for_department(dept)
        all_scraped_courses.extend(dept_courses)

    # ------------------------------------------------------------------
    # FILTER RELEVANT SCRAPED COURSES ONLY
    # ------------------------------------------------------------------
    # Normalize for matching: "COMP 1405" → "COMP1405"
    requested_codes_set = {code.upper().replace(" ", "") for code in all_codes}
    relevant_courses = []
    for c in all_scraped_courses:
        normalized_scraped = c.course_code.upper().replace(" ", "")
        if normalized_scraped in requested_codes_set:
            relevant_courses.append(c)

    # ------------------------------------------------------------------
    # WRITE ONLY THE RELEVANT COURSES TO .MD
    # ------------------------------------------------------------------
    output_file = "scraped_courses.md"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("# Course List\n\n")
        for c in relevant_courses:
            f.write(f"## {c.course_code} (Section {c.section})\n\n")
            f.write(f"- **CRN**: {c.crn}\n")
            f.write(f"- **Title**: {c.course_title}\n")
            f.write(f"- **Status**: {c.status}\n")
            f.write(f"- **Credits**: {c.credits}\n")
            f.write(f"- **Schedule Type**: {c.schedule_type}\n")
            f.write(f"- **Instructor**: {c.instructor}\n")
            f.write(f"- **Days**: {c.day}\n")
            f.write(f"- **Time**: {c.start_time} - {c.end_time}\n")
            if c.also_register_in:
                f.write(f"- **Also Register in**: {c.also_register_in}\n")
            f.write("\n---\n\n")

    print(f"\nWrote {len(relevant_courses)} relevant courses to {output_file}")

    # ------------------------------------------------------------------
    # (C) GENERATE SCHEDULES
    # ------------------------------------------------------------------
    mandatory_list = [c.course_code for c in codes_response.mandatory]
    elective_list = [c.course_code for c in codes_response.electives]

    schedules_response = generate_schedules(
        client=client,
        md_file_path=output_file,
        mandatory_courses=mandatory_list,
        elective_courses=elective_list,
        special_requests=codes_response.special_request,
        model="llama3-70b-8192"
    )

    print("\n--- GENERATE SCHEDULES RESPONSE ---")
    print(schedules_response.model_dump_json(indent=2))