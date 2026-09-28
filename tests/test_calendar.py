"""
Calendar events endpoint tests.
"""
import pytest
import uuid
from datetime import datetime, timedelta, timezone
from test_client import APIClient


def get_iso_datetime(minutes_from_now=0):
    """Helper to get ISO format datetime for API requests."""
    dt = datetime.now(timezone.utc) + timedelta(minutes=minutes_from_now)
    # Replace the timezone offset with Z for backend compatibility
    return dt.replace(tzinfo=None).isoformat() + 'Z'


@pytest.mark.calendar
class TestCalendarEvents:
    """Test calendar events endpoints."""
    
    def test_list_events_empty(self, authenticated_client: APIClient):
        """Test listing events when user has no events."""
        response = authenticated_client.get('/api/calendar/events')
        assert response.status_code == 200
        assert response.json() == []
    
    def test_create_event_minimal(self, authenticated_client: APIClient):
        """Test creating an event with minimal required data."""
        event_data = {
            'title': 'Test Event',
            'start_time': get_iso_datetime(60),
            'end_time': get_iso_datetime(120)
        }
        
        response = authenticated_client.post('/api/calendar/events', json=event_data)
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert data['title'] == 'Test Event'
        assert 'id' in data
        assert 'created_at' in data
        assert data['status'] == 'confirmed'  # default
        assert data['transparency'] == 'opaque'  # default
        assert data['visibility'] == 'private'  # default
        assert data['color'] == '#3b82f4'  # default
    
    def test_create_event_full(self, authenticated_client: APIClient):
        """Test creating an event with all fields."""
        event_data = {
            'title': 'Full Event',
            'description': 'Event description',
            'start_time': get_iso_datetime(60),
            'end_time': get_iso_datetime(120),
            'original_tz': 'America/New_York',
            'status': 'tentative',
            'transparency': 'transparent',
            'visibility': 'public',
            'color': '#ff0000'
        }
        
        response = authenticated_client.post('/api/calendar/events', json=event_data)
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert data['title'] == 'Full Event'
        assert data['description'] == 'Event description'
        assert data['original_tz'] == 'America/New_York'
        assert data['status'] == 'tentative'
        assert data['transparency'] == 'transparent'
        assert data['visibility'] == 'public'
        assert data['color'] == '#ff0000'
    
    def test_create_event_with_recurrence(self, authenticated_client: APIClient):
        """Test creating an event with recurrence rule."""
        event_data = {
            'title': 'Recurring Event',
            'start_time': get_iso_datetime(60),
            'end_time': get_iso_datetime(120),
            'rrule': 'FREQ=DAILY;COUNT=5'
        }
        
        response = authenticated_client.post('/api/calendar/events', json=event_data)
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert data['rrule'] == 'FREQ=DAILY;COUNT=5'
    
    def test_list_events_with_data(self, authenticated_client: APIClient):
        """Test listing events when user has events."""
        # Create an event
        event_data = {
            'title': 'Test Event',
            'start_time': get_iso_datetime(60),
            'end_time': get_iso_datetime(120)
        }
        authenticated_client.post('/api/calendar/events', json=event_data)
        
        # List events
        response = authenticated_client.get('/api/calendar/events')
        assert response.status_code == 200
        events = response.json()
        assert len(events) == 1
        assert events[0]['title'] == 'Test Event'
    
    def test_list_events_with_date_filter(self, authenticated_client: APIClient):
        """Test listing events with date range filter."""
        # Create events at different times
        event1_data = {
            'title': 'Event 1',
            'start_time': get_iso_datetime(60),
            'end_time': get_iso_datetime(120)
        }
        event2_data = {
            'title': 'Event 2',
            'start_time': get_iso_datetime(300),
            'end_time': get_iso_datetime(360)
        }
        authenticated_client.post('/api/calendar/events', json=event1_data)
        authenticated_client.post('/api/calendar/events', json=event2_data)
        
        # Filter by date range
        start_date = get_iso_datetime(0)
        end_date = get_iso_datetime(180)
        response = authenticated_client.get(f'/api/calendar/events?start_date={start_date}&end_date={end_date}')
        assert response.status_code == 200
        
        events = response.json()
        assert len(events) == 1
        assert events[0]['title'] == 'Event 1'
    
    def test_get_event_by_id(self, authenticated_client: APIClient):
        """Test getting a specific event by ID."""
        # Create an event
        event_data = {
            'title': 'Test Event',
            'start_time': get_iso_datetime(60),
            'end_time': get_iso_datetime(120)
        }
        create_response = authenticated_client.post('/api/calendar/events', json=event_data)
        event_id = create_response.json()['id']
        
        # Get the event
        response = authenticated_client.get(f'/api/calendar/events/{event_id}')
        assert response.status_code == 200
        
        data = response.json()
        assert data['id'] == event_id
        assert data['title'] == 'Test Event'
    
    def test_get_event_not_found(self, authenticated_client: APIClient):
        """Test getting a non-existent event."""
        fake_id = uuid.uuid4()
        response = authenticated_client.get(f'/api/calendar/events/{fake_id}')
        assert response.status_code == 404
    
    def test_update_event_title(self, authenticated_client: APIClient):
        """Test updating event title."""
        # Create an event
        event_data = {
            'title': 'Original Title',
            'start_time': get_iso_datetime(60),
            'end_time': get_iso_datetime(120)
        }
        create_response = authenticated_client.post('/api/calendar/events', json=event_data)
        event_id = create_response.json()['id']
        
        # Update title
        update_data = {'title': 'Updated Title'}
        response = authenticated_client.patch(f'/api/calendar/events/{event_id}', json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data['title'] == 'Updated Title'
    
    def test_update_event_times(self, authenticated_client: APIClient):
        """Test updating event start and end times."""
        # Create an event
        event_data = {
            'title': 'Test Event',
            'start_time': get_iso_datetime(60),
            'end_time': get_iso_datetime(120)
        }
        create_response = authenticated_client.post('/api/calendar/events', json=event_data)
        event_id = create_response.json()['id']
        
        # Update times
        update_data = {
            'start_time': get_iso_datetime(180),
            'end_time': get_iso_datetime(240)
        }
        response = authenticated_client.patch(f'/api/calendar/events/{event_id}', json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data['start_time'] == update_data['start_time']
        assert data['end_time'] == update_data['end_time']
    
    def test_update_event_partial(self, authenticated_client: APIClient):
        """Test partial update of event fields."""
        # Create an event
        event_data = {
            'title': 'Test Event',
            'start_time': get_iso_datetime(60),
            'end_time': get_iso_datetime(120)
        }
        create_response = authenticated_client.post('/api/calendar/events', json=event_data)
        event_id = create_response.json()['id']
        
        # Update only color
        update_data = {'color': '#00ff00'}
        response = authenticated_client.patch(f'/api/calendar/events/{event_id}', json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data['color'] == '#00ff00'
        assert data['title'] == event_data['title']  # unchanged
    
    def test_update_event_not_found(self, authenticated_client: APIClient):
        """Test updating a non-existent event."""
        fake_id = uuid.uuid4()
        update_data = {'title': 'Updated Title'}
        response = authenticated_client.patch(f'/api/calendar/events/{fake_id}', json=update_data)
        assert response.status_code == 404
    
    def test_delete_event(self, authenticated_client: APIClient):
        """Test deleting an event."""
        # Create an event
        event_data = {
            'title': 'Test Event',
            'start_time': get_iso_datetime(60),
            'end_time': get_iso_datetime(120)
        }
        create_response = authenticated_client.post('/api/calendar/events', json=event_data)
        event_id = create_response.json()['id']
        
        # Delete the event
        response = authenticated_client.delete(f'/api/calendar/events/{event_id}')
        assert response.status_code == 204
        
        # Verify it's deleted
        get_response = authenticated_client.get(f'/api/calendar/events/{event_id}')
        assert get_response.status_code == 404
    
    def test_delete_event_not_found(self, authenticated_client: APIClient):
        """Test deleting a non-existent event."""
        fake_id = uuid.uuid4()
        response = authenticated_client.delete(f'/api/calendar/events/{fake_id}')
        assert response.status_code == 404
    
    def test_event_ownership(self, authenticated_client: APIClient):
        """Test that users can only access their own events."""
        # Create an event
        event_data = {
            'title': 'User Event',
            'start_time': get_iso_datetime(60),
            'end_time': get_iso_datetime(120)
        }
        create_response = authenticated_client.post('/api/calendar/events', json=event_data)
        event_id = create_response.json()['id']
        
        # Verify the event exists for the original user
        response = authenticated_client.get(f'/api/calendar/events/{event_id}')
        assert response.status_code == 200
