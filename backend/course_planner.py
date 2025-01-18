from typing import List, Optional
import os
import json
from pydantic import BaseModel
from dotenv import load_dotenv
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
    """
    status: str               # "success" or "error"
    requested_input: str      # The transcribed user speech
    mandatory: List[CourseCode] = []
    electives: List[CourseCode] = []


# ----------------------------------------------------------------------
# 2) SCHEMA FOR GENERATE_SCHEDULES
# ----------------------------------------------------------------------
class ScheduleCourse(BaseModel):
    """
    Represents a single class’s schedule information, including additional fields:
      - status
      - crn
      - course_code
      - section
      - course_title
      - credits
      - schedule_type
      - instructor
      - day
      - start_time
      - end_time
    """
    status: str               # e.g. "open", "registration closed"
    crn: str                  # random numeric identifier, e.g. "12345"
    course_code: str
    section: str              # e.g. "A", "B"
    course_title: str         # e.g. "Intro to Programming"
    credits: float            # e.g. 0, 0.5, or 1
    schedule_type: str        # "lecture" or "tutorial"
    instructor: str           # e.g. "Jane Smith"
    day: str
    start_time: str
    end_time: str


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
# get_course_codes FUNCTION (AUDIO ONLY)
# ----------------------------------------------------------------------
def get_course_codes(
    client: Groq,
    audio_file_path: str,
    allowed_codes: List[str],  # Restrict recognized course codes to this list
    transcription_model: str = "whisper-large-v3-turbo",
    prompt: Optional[str] = None,
    model: str = "llama3-70b-8192",  # or whichever Groq model you prefer
) -> GetCourseCodesResponse:
    """
    1) Transcribes the given audio file using the Groq audio API.
    2) Uses chat completions with JSON mode to return a GetCourseCodesResponse object,
       splitting recognized codes into 'mandatory' or 'electives'. If not specified,
       default to 'mandatory'.

    The 'allowed_codes' parameter can be used to restrict recognized courses
    to a predefined set (e.g., ["COMP1405","COMP1805"]).
    """

    # Step 1: Transcribe the audio
    try:
        with open(audio_file_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=(audio_file_path, audio_file.read()),
                model=transcription_model,
                prompt=prompt or "",
                language="en",
                temperature=0.0
            )
    except FileNotFoundError:
        return GetCourseCodesResponse(
            status="error",
            requested_input=f"File not found: {audio_file_path}",
            mandatory=[],
            electives=[]
        )
    except Exception as e:
        return GetCourseCodesResponse(
            status="error",
            requested_input=str(e),
            mandatory=[],
            electives=[]
        )

    user_query = transcription.text or ""
    if not user_query.strip():
        return GetCourseCodesResponse(
            status="error",
            requested_input="No transcribed text found.",
            mandatory=[],
            electives=[]
        )

    # Step 2: Instruct the model about mandatory vs. elective
    schema_text = json.dumps(GetCourseCodesResponse.model_json_schema(), indent=2)
    system_prompt = (
        "You are a course code extraction assistant. You must output JSON that "
        "matches this schema:\n\n"
        f"{schema_text}\n\n"
        "The schema has two lists: 'mandatory' and 'electives'. "
        "If the user explicitly says a course is 'optional' or 'elective', put it in 'electives'. "
        "Otherwise, put it in 'mandatory'.\n\n"
        "The ONLY valid course codes are listed below. "
        "If the user mentions codes not in this list, ignore them or find the closest valid code.\n"
        f"Allowed codes: {allowed_codes}\n\n"
        "Ensure you strictly follow the JSON schema.\n"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_query},
    ]

    try:
        # Step 3: Chat completion in JSON mode
        chat_completion = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0,
            stream=False,
            response_format={"type": "json_object"},  # Use JSON mode
        )

        # Parse JSON output into our new GetCourseCodesResponse model
        parsed_response = GetCourseCodesResponse.model_validate_json(
            chat_completion.choices[0].message.content
        )

        # Filter out any codes not in allowed_codes
        filtered_mandatory = [
            c for c in parsed_response.mandatory
            if c.course_code in allowed_codes
        ]
        filtered_electives = [
            c for c in parsed_response.electives
            if c.course_code in allowed_codes
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
            mandatory=[],
            electives=[]
        )


# ----------------------------------------------------------------------
# generate_schedules FUNCTION
# ----------------------------------------------------------------------
def generate_schedules(
    client: Groq,
    md_file_path: str,
    mandatory_courses: List[str],
    elective_courses: List[str],
    special_requests: Optional[str] = None,
    model: str = "llama3-70b-8192",  # or whichever Groq model
) -> GenerateSchedulesResponse:
    """
    Generates one or more possible schedules based on a .md file describing class times,
    a list of mandatory/elective courses, and any special constraints. Uses JSON mode
    to return a GenerateSchedulesResponse object.

    The ScheduleCourse model includes:
      - status
      - crn
      - course_code
      - section
      - course_title
      - credits
      - schedule_type
      - instructor
      - day
      - start_time
      - end_time
    """

    # Attempt to read the .md file
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

    # Build the system message, including the JSON schema
    schema_text = json.dumps(GenerateSchedulesResponse.model_json_schema(), indent=2)
    system_prompt = (
        "You are a scheduling assistant. You must output JSON that matches this schema:\n\n"
        f"{schema_text}\n\n"
        "Each course in the schedules array must include:\n"
        "- status (open or registration closed)\n"
        "- crn (random numeric ID)\n"
        "- course_code\n"
        "- section (e.g., A, B)\n"
        "- course_title\n"
        "- credits (e.g. 0, 0.5, or 1)\n"
        "- schedule_type (lecture or tutorial)\n"
        "- instructor (random name)\n"
        "- day\n"
        "- start_time\n"
        "- end_time\n\n"
        "Ensure your JSON strictly follows the schema (keys, data types, etc.)."
    )

    user_msg = f"""
MANDATORY COURSES: {mandatory_courses}
ELECTIVE COURSES: {elective_courses}
SPECIAL REQUESTS: {special_requests or "None"}
MARKDOWN FILE CONTENT:
{md_content}
"""

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
            response_format={"type": "json_object"},  # JSON mode
        )

        parsed = GenerateSchedulesResponse.model_validate_json(
            chat_completion.choices[0].message.content
        )

        # Optionally override or fill out certain fields
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
# USAGE EXAMPLE (not executed by default)
# ----------------------------------------------------------------------
if __name__ == "__main__":
    load_dotenv()
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    # Example: Provide some subset of valid course codes
    valid_codes = [
        "COMP1405", "COMP1805", "COMP2804", "COMP1406"
    ]

    # 1) GET COURSE CODES (audio only)
    audio_path = os.path.join(os.path.dirname(__file__), "test2.m4a")
    codes_response = get_course_codes(
        client=client,
        audio_file_path=audio_path,
        allowed_codes=valid_codes,
        transcription_model="whisper-large-v3-turbo",
        prompt="Clarify domain-specific terms if needed.",
        model="llama3-70b-8192"
    )
    print("\n--- GET COURSE CODES RESPONSE ---")
    print(codes_response.model_dump_json(indent=2))

    # 2) PASS THE RESULTS INTO generate_schedules
    mandatory_list = [c.course_code for c in codes_response.mandatory]
    elective_list = [c.course_code for c in codes_response.electives]

    # Example usage with a file named "classes.md" (see below)
    schedules_response = generate_schedules(
        client=client,
        md_file_path="classes.md",
        mandatory_courses=mandatory_list,
        elective_courses=elective_list,
        special_requests="No classes on Friday.",
        model="llama3-70b-8192"
    )
    print("\n--- GENERATE SCHEDULES RESPONSE ---")
    print(schedules_response.model_dump_json(indent=2))