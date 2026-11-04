"""
Google Calendar integration utility for 국군수송중앙교회:
1. Instant 1-click Google Calendar URL generation
2. iCalendar (.ics) standard export file generation
"""
import urllib.parse
from datetime import datetime, timedelta

def generate_google_calendar_url(title, start_dt_str, end_dt_str, details="", location="국군수송중앙교회 본당 1층 상담실"):
    """
    start_dt_str: 'YYYY-MM-DD HH:MM'
    end_dt_str: 'YYYY-MM-DD HH:MM'
    Generates a web intent link that immediately opens Google Calendar to add this event.
    """
    try:
        s_dt = datetime.strptime(start_dt_str, "%Y-%m-%d %H:%M")
        e_dt = datetime.strptime(end_dt_str, "%Y-%m-%d %H:%M")
    except Exception:
        # Fallback if only date provided
        s_dt = datetime.now()
        e_dt = s_dt + timedelta(hours=1)

    s_formatted = s_dt.strftime("%Y%m%dT%H%M00")
    e_formatted = e_dt.strftime("%Y%m%dT%H%M00")
    dates_param = f"{s_formatted}/{e_formatted}"

    base_url = "https://calendar.google.com/calendar/render"
    params = {
        "action": "TEMPLATE",
        "text": f"[국군수송중앙교회] {title}",
        "dates": dates_param,
        "details": details,
        "location": location,
        "sf": "true",
        "output": "xml"
    }

    return f"{base_url}?{urllib.parse.urlencode(params)}"

def generate_ics_content(title, start_dt_str, end_dt_str, details="", location="국군수송중앙교회"):
    """
    Generates standard .ics file content
    """
    s_dt = datetime.strptime(start_dt_str, "%Y-%m-%d %H:%M")
    e_dt = datetime.strptime(end_dt_str, "%Y-%m-%d %H:%M")
    
    s_ics = s_dt.strftime("%Y%m%dT%H%M00")
    e_ics = e_dt.strftime("%Y%m%dT%H%M00")
    now_ics = datetime.utcnow().strftime("%Y%m%dT%H%M00Z")
    
    clean_details = details.replace('\n', '\\n')
    
    ics = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ROK Transportation Command Church//Counseling System//KO
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:[국군수송중앙교회] {title}
DTSTART:{s_ics}
DTEND:{e_ics}
DTSTAMP:{now_ics}
UID:{int(s_dt.timestamp())}@transcom-church.mil
DESCRIPTION:{clean_details}
LOCATION:{location}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR"""
    return ics
