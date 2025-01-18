from selenium import webdriver
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from bs4 import BeautifulSoup
import json
import logging
from datetime import datetime
import time

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    filename='course_scraper.log'
)

class CourseScheduleScraper:
    def __init__(self):
        self.setup_driver()
        self.base_url = 'https://central.carleton.ca/prod/bwysched.p_select_term?wsea_code=EXT'
        self.wait = WebDriverWait(self.driver, 10)
        
    def setup_driver(self):
        """Initialize Chrome driver with appropriate options"""
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--disable-gpu')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=options)

    def scrape_courses(self, input_data):
        """
        Main method to scrape courses based on input parameters
        
        Args:
            input_data (dict): Contains 'term', 'levl_id', and 'subjects' keys
        """
        try:
            logging.info(f"Starting scrape for term {input_data['term']}")
            self.navigate_to_term_page(input_data['term'])
            course_data = []
            
            for subject_code in input_data['subjects']:
                try:
                    subject_courses = self.scrape_subject(subject_code, input_data['levl_id'])
                    course_data.extend(subject_courses)
                    logging.info(f"Successfully scraped {len(subject_courses)} courses for {subject_code}")
                except Exception as e:
                    logging.error(f"Error scraping subject {subject_code}: {str(e)}")
                    continue
            
            self.generate_markdown(course_data)
            self.generate_json(course_data)  # Also save as JSON for potential future use
            
        except Exception as e:
            logging.error(f"Fatal error in scrape_courses: {str(e)}")
            raise
        finally:
            self.driver.quit()

    def navigate_to_term_page(self, term_code):
        """Navigate to the term selection page and select the specified term"""
        self.driver.get(self.base_url)
        term_dropdown = self.wait.until(EC.presence_of_element_located((By.NAME, 'term_code')))
        Select(term_dropdown).select_by_value(term_code)
        self.driver.find_element(By.XPATH, '//input[@type="submit"]').click()
        self.wait.until(EC.presence_of_element_located((By.ID, 'subj_id')))

    def scrape_subject(self, subject_code, level_id):
        """Scrape courses for a specific subject and level"""
        subject_courses = []
        try:
            # Select subject and level
            Select(self.driver.find_element(By.ID, 'subj_id')).select_by_value(subject_code)
            Select(self.driver.find_element(By.ID, 'levl_id')).select_by_value(level_id)
            self.driver.find_element(By.XPATH, '//input[@type="submit"]').click()

            # Wait for results or handle no results case
            try:
                table = self.wait.until(EC.presence_of_element_located(
                    (By.XPATH, '//table[@width="883"]')
                ))
                subject_courses = self.parse_course_table(self.driver.page_source)
            except TimeoutException:
                logging.info(f"No courses found for {subject_code}")
                return []

            # Navigate back for next subject
            self.driver.back()
            self.wait.until(EC.presence_of_element_located((By.ID, 'subj_id')))
            
        except Exception as e:
            logging.error(f"Error in scrape_subject for {subject_code}: {str(e)}")
            raise
            
        return subject_courses

    def parse_course_table(self, page_source):
        """Parse the HTML table containing course information"""
        courses = []
        soup = BeautifulSoup(page_source, 'html.parser')
        table = soup.find_all('table', {'width': '883'})[1]
        rows = table.find_all('tr')
        
        i = 0
        while i < len(rows):
            try:
                cols = rows[i].find_all('td')
                if len(cols) >= 11:
                    course_info = {
                        'status': cols[1].get_text(strip=True),
                        'course_name': cols[3].get_text(strip=True),
                        'section': cols[4].get_text(strip=True),
                        'course_type': cols[7].get_text(strip=True),
                        'professor': cols[10].get_text(strip=True),
                        'meeting_date': '',
                        'days': '',
                        'time': '',
                        'building': '',
                        'room': '',
                        'prerequisites': '',
                        'additional_info': []
                    }
                    
                    # Parse next rows for additional information
                    i += 1
                    while i < len(rows) and not rows[i].find_all('td')[0].get('width', '') == '5%':
                        next_cols = rows[i].find_all('td')
                        if len(next_cols) > 1:
                            info_text = next_cols[1].get_text(strip=True)
                            self.parse_additional_info(info_text, course_info)
                        i += 1
                        
                    courses.append(course_info)
                    continue
                    
            except Exception as e:
                logging.error(f"Error parsing row {i}: {str(e)}")
                
            i += 1
            
        return courses

    def parse_additional_info(self, info_text, course_info):
        """Parse additional course information from text"""
        if 'Meeting Date:' in info_text:
            parts = info_text.split(' ')
            for i, part in enumerate(parts):
                if part == 'Date:':
                    course_info['meeting_date'] = parts[i + 1]
                elif part == 'Days:':
                    course_info['days'] = parts[i + 1]
                elif part == 'Time:':
                    course_info['time'] = f"{parts[i + 1]} {parts[i + 2]} {parts[i + 3]}"
                elif part == 'Building:':
                    course_info['building'] = parts[i + 1]
                elif part == 'Room:':
                    course_info['room'] = parts[i + 1]
        elif 'Prerequisites' in info_text:
            course_info['prerequisites'] = info_text
        else:
            course_info['additional_info'].append(info_text)

    def generate_markdown(self, course_data):
        """Generate a formatted Markdown file from course data"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        with open('courses.md', 'w', encoding='utf-8') as md_file:
            md_file.write(f"# Carleton University Course Schedule\n\n")
            md_file.write(f"Generated: {timestamp}\n\n")
            
            current_subject = None
            for course in course_data:
                subject = course['course_name'].split()[0]
                if subject != current_subject:
                    current_subject = subject
                    md_file.write(f"\n## {subject}\n\n")
                
                md_file.write(f"### {course['course_name']} ({course['section']})\n")
                md_file.write(f"- **Status:** {course['status']}\n")
                md_file.write(f"- **Type:** {course['course_type']}\n")
                md_file.write(f"- **Professor:** {course['professor']}\n")
                
                if course['meeting_date']:
                    md_file.write(f"- **Meeting Date:** {course['meeting_date']}\n")
                if course['days']:
                    md_file.write(f"- **Days:** {course['days']}\n")
                if course['time']:
                    md_file.write(f"- **Time:** {course['time']}\n")
                if course['building'] or course['room']:
                    md_file.write(f"- **Location:** {course['building']} {course['room']}\n")
                if course['prerequisites']:
                    md_file.write(f"- **Prerequisites:** {course['prerequisites']}\n")
                
                if course['additional_info']:
                    md_file.write("- **Additional Information:**\n")
                    for info in course['additional_info']:
                        md_file.write(f"  - {info}\n")
                
                md_file.write("\n---\n\n")

    def generate_json(self, course_data):
        """Save the course data as JSON for potential future use"""
        with open('courses.json', 'w', encoding='utf-8') as json_file:
            json.dump(course_data, json_file, indent=2, ensure_ascii=False)

def main():
    # Example usage
    input_data = {
        'term': '202510',
        'levl_id': 'UG',
        'subjects': ['AERO', 'COMP', 'MATH']
    }
    
    try:
        scraper = CourseScheduleScraper()
        scraper.scrape_courses(input_data)
        logging.info("Scraping completed successfully")
    except Exception as e:
        logging.error(f"Failed to complete scraping: {str(e)}")

if __name__ == "__main__":
    main()