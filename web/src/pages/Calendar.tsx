import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../utils/useAPI';
import { arrowIcon, calendarIcon } from '../assets/icons';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  original_tz: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  transparency: 'opaque' | 'transparent';
  visibility: 'public' | 'private' | 'confidential';
  color: string;
}

type ViewMode = 'day' | 'week' | 'month';

const CURRENT_TIME_LINE_COLOR = '#adff23';

export default function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const { token } = useAuth();
  const { fetchAPI } = useAPI();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
    const [now, setNow] = useState(new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventColor, setNewEventColor] = useState("var(--accent)");
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [hoveredModalButton, setHoveredModalButton] = useState<'delete' | 'cancel' | 'save' | null>(null);
    const [hoveredColorSwatch, setHoveredColorSwatch] = useState<string | null>(null);
        const [activeInputField, setActiveInputField] = useState<'title' | 'start' | 'end' | null>(null);

  // Default new event times
  const getDefaultEventTimes = () => {
    const start = new Date(currentDate);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    return { start, end };
  };

  const toLocalISOString = (date: Date) => {
    const pad = (n: number) => n < 10 ? '0' + n : n;
    return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes());
  };

  const [newEventStart, setNewEventStart] = useState("");
  const [newEventEnd, setNewEventEnd] = useState("");

  // Helper to init modal with specific times
  const openModalWithTimes = (start: Date, end: Date) => {
      setNewEventStart(toLocalISOString(start));
      setNewEventEnd(toLocalISOString(end));
      setNewEventTitle("");
      setNewEventColor("var(--accent)");
      setModalMode('create');
      setIsModalOpen(true);
  };

  const openModalEdit = (event: CalendarEvent) => {
      setNewEventTitle(event.title);
      setNewEventStart(toLocalISOString(new Date(event.start_time)));
      setNewEventEnd(toLocalISOString(new Date(event.end_time)));
      setNewEventColor(event.color || "var(--accent)");
      setSelectedEventId(event.id);
      setModalMode('edit');
      setIsModalOpen(true);
  };

  const handleCreateEventClick = () => {
    const { start, end } = getDefaultEventTimes();
    openModalWithTimes(start, end);
  };


  // --- Date Helpers ---
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday, behave like Monday is first day
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getEndOfWeek = (date: Date) => {
    const d = getStartOfWeek(date);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const days: { date: Date; isCurrentMonth: boolean }[] = [];
      // Fill previous month days to start on Monday (or Sunday)
      let startDay = firstDay.getDay(); // 0-6
      const offset = startDay === 0 ? 6 : startDay - 1; // 0=Mon, 6=Sun
      
      for (let i = offset; i > 0; i--) {
          const d = new Date(year, month, 1 - i);
          days.push({ date: d, isCurrentMonth: false });
      }

      for (let i = 1; i <= lastDay.getDate(); i++) {
          const d = new Date(year, month, i);
          days.push({ date: d, isCurrentMonth: true });
      }

      // Fill remaining days to complete the grid
      while (days.length % 7 !== 0) {
          const last = days[days.length - 1].date;
          const d = new Date(last);
          d.setDate(d.getDate() + 1);
          days.push({ date: d, isCurrentMonth: false });
      }

      return days;
  };

  // --- Fetch Events ---
  useEffect(() => {
    if (!token) return;

    let start = new Date(currentDate);
    let end = new Date(currentDate);

    if (viewMode === 'day') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'week') {
        start = getStartOfWeek(currentDate);
        end = getEndOfWeek(currentDate);
    } else {
        // Month view: Fetch a bit more to cover full grid
        const days = getDaysInMonth(currentDate);
        start = days[0].date;
        end = days[days.length - 1].date;
        end.setHours(23, 59, 59, 999);
    }

    const query = new URLSearchParams({
        start_date: start.toISOString(),
        end_date: end.toISOString()
    });

    fetchAPI(`/api/calendar/events?${query}`)
        .then(res => res.json())
        .then(data => setEvents(data))
        .catch(err => console.error(err));
    }, [token, currentDate, viewMode, fetchAPI]);


  // --- Event Creation / Update ---
  const handleSaveEvent = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!token) return;

      const payload = {
          title: newEventTitle,
          start_time: new Date(newEventStart).toISOString(),
          end_time: new Date(newEventEnd).toISOString(),
          color: newEventColor,
          original_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          status: 'confirmed',
          transparency: 'opaque',
          visibility: 'private'
      };

      try {
          let endpoint = `/api/calendar/events`;
          let method = 'POST';

          if (modalMode === 'edit' && selectedEventId) {
              endpoint = `/api/calendar/events/${selectedEventId}`;
              method = 'PATCH';
          }

          const res = await fetchAPI(endpoint, {
              method: method,
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
          });

          if (res.ok) {
              const savedEvent = await res.json();
              if (modalMode === 'create') {
                  setEvents([...events, savedEvent]);
              } else {
                  setEvents(events.map(ev => ev.id === savedEvent.id ? savedEvent : ev));
              }
              setIsModalOpen(false);
              setNewEventTitle("");
              setSelectedEventId(null);
          } else {
              const errorText = await res.text();
              alert(`Failed to save event: ${errorText}`);
          }
      } catch (err) {
          console.error(err);
      }
  };

  const handleDeleteEvent = async () => {
      if (!token || !selectedEventId) return;

      const shouldDelete = window.confirm('Are you sure you want to delete this event?');
      if (!shouldDelete) return;

      try {
          const res = await fetchAPI(`/api/calendar/events/${selectedEventId}`, {
              method: 'DELETE'
          });

          if (res.ok) {
              setEvents(events.filter(ev => ev.id !== selectedEventId));
              setIsModalOpen(false);
              setNewEventTitle('');
              setSelectedEventId(null);
          } else {
              const errorText = await res.text();
              alert(`Failed to delete event: ${errorText}`);
          }
      } catch (err) {
          console.error(err);
      }
  };


  // --- Navigation Handlers ---
  const handlePrev = () => {
      const newDate = new Date(currentDate);
      if (viewMode === 'day') newDate.setDate(newDate.getDate() - 1);
      if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
      if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
      setCurrentDate(newDate);
  };

  const handleNext = () => {
      const newDate = new Date(currentDate);
      if (viewMode === 'day') newDate.setDate(newDate.getDate() + 1);
      if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
      if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
      setCurrentDate(newDate);
  };

  const isSameDate = (d1: Date, d2: Date) => {
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
  };

  const getDayBounds = (date: Date) => {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end };
  };

  useEffect(() => {
      const intervalId = window.setInterval(() => {
          setNow(new Date());
      }, 60000);

      return () => {
          window.clearInterval(intervalId);
      };
  }, []);

  // Render Logic
  const renderWeekView = () => {
      const startOfWeek = getStartOfWeek(currentDate);
      // Generate days for the view (7 for week, 1 for day)
      const daysToShow = viewMode === 'day' ? 1 : 7;
      const viewDays = Array.from({ length: daysToShow }).map((_, i) => {
          const d = new Date(viewMode === 'day' ? currentDate : startOfWeek);
          if (viewMode === 'week') d.setDate(d.getDate() + i);
          return d;
      });

      const currentTimeTop = (now.getHours() + now.getMinutes() / 60) * 60;
      const todayColumnIndex = viewDays.findIndex((day) => isSameDate(day, now));

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
            {/* Header / Week Days */}
            <div style={{ display: 'flex', paddingLeft: '60px', borderBottom: '1px solid var(--card-bg)' }}>
                {viewDays.map((day, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderLeft: '1px solid var(--card-bg)', fontWeight: isSameDate(day, new Date()) ? 'bold' : 'normal', color: isSameDate(day, new Date()) ? 'var(--accent)' : 'var(--text-secondary)' }}>
                        <div>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div style={{ fontSize: '1.2rem' }}>{day.getDate()}</div>
                    </div>
                ))}
            </div>

            {/* Scrollable Time Grid */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', position: 'relative' }}>
                {/* Time Gutter */}
                <div style={{ width: '60px', flexShrink: 0 }}>
                    {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} style={{ height: '60px', borderBottom: '1px solid var(--card-bg)', textAlign: 'right', paddingRight: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {i}:00
                        </div>
                    ))}
                </div>

                {/* Columns & Events */}
                <div style={{ flex: 1, position: 'relative', display: 'flex', height: '1440px' }}>
                    {/* Background Grid Lines (Horizontal) */}
                    {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} style={{ position: 'absolute', top: `${i * 60}px`, left: 0, right: 0, height: '60px', borderBottom: '1px solid var(--card-bg)', pointerEvents: 'none' }}></div>
                    ))}
                    
                    {/* Column Borders (Vertical) */}
                    {viewDays.map((_, i) => (
                        <div key={i} style={{ flex: 1, borderLeft: '1px solid var(--card-bg)', height: '1440px', pointerEvents: 'none' }}></div>
                    ))}

                    {/* Interaction Layer */}
                    <div 
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1440px', zIndex: 5, cursor: 'crosshair' }}
                        // Calculate Time logic needs to use offsetY from event if relative, but getBoundingClientRect is safer due to scrolling
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const y = e.clientY - rect.top; // Relative to viewport top vs element top works even with scroll

                            const colWidth = rect.width / daysToShow;
                            const colIndex = Math.floor(x / colWidth);
                            
                            if (colIndex < 0 || colIndex >= viewDays.length) return;

                            const clickedDate = new Date(viewDays[colIndex]);
                            
                            // 60px per hour
                            // rect.height should be 1440
                            let hourRaw = y / 60;
                            // Clamp
                            if (hourRaw < 0) hourRaw = 0;
                            if (hourRaw > 23.9) hourRaw = 23.9;

                            const hour = Math.floor(hourRaw);
                            const minuteRaw = (hourRaw - hour) * 60;
                            
                            // Snap to 30 mins for easier clicking
                            const minute = Math.round(minuteRaw / 30) * 30;

                            clickedDate.setHours(hour, minute, 0, 0);
                            const endDate = new Date(clickedDate);
                            endDate.setHours(clickedDate.getHours() + 1);
                            
                            openModalWithTimes(clickedDate, endDate);
                        }}
                    ></div>

                    {/* Events */}
                    {events.flatMap(event => {
                         const start = new Date(event.start_time);
                         const end = new Date(event.end_time);
                         const widthPercent = 100 / daysToShow;

                         return viewDays.map((day, colIndex) => {
                             const { start: dayStart, end: dayEnd } = getDayBounds(day);
                             const segmentStart = start > dayStart ? start : dayStart;
                             const segmentEnd = end < dayEnd ? end : dayEnd;

                             if (segmentStart >= segmentEnd) return null;

                             const startHours = segmentStart.getHours() + segmentStart.getMinutes() / 60;
                             const durationHours = (segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60 * 60);
                             const leftPercent = colIndex * widthPercent;

                             return (
                                 <div 
                                    key={`${event.id}-${day.toISOString()}`}
                                    title={event.title}
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        openModalEdit(event);
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: `${startHours * 60}px`,
                                        height: `${Math.max(durationHours * 60, 25)}px`,
                                        left: `${leftPercent}%`,
                                        width: `${widthPercent}%`,
                                        padding: '2px',
                                        zIndex: 10
                                    }}
                                 >
                                     <div style={{
                                         backgroundColor: event.color || 'var(--accent)',
                                         borderLeft: '3px solid rgba(0,0,0,0.2)',
                                         height: '100%',
                                         borderRadius: '4px',
                                         padding: '4px',
                                         fontSize: '0.75rem',
                                         overflow: 'hidden',
                                         cursor: 'pointer',
                                         color: 'white'
                                     }}>
                                        <strong>{event.title}</strong>
                                        <div>{segmentStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                     </div>
                                 </div>
                             );
                         });
                    })}

                    {/* Current time indicator */}
                    {todayColumnIndex !== -1 && (
                        <div
                            style={{
                                position: 'absolute',
                                top: `${currentTimeTop}px`,
                                left: `${todayColumnIndex * (100 / daysToShow)}%`,
                                width: `${100 / daysToShow}%`,
                                height: '0',
                                borderTop: `2px solid ${CURRENT_TIME_LINE_COLOR}`,
                                zIndex: 25,
                                pointerEvents: 'none'
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    left: '-4px',
                                    top: '-5px',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: CURRENT_TIME_LINE_COLOR,
                                    boxShadow: `0 0 8px ${CURRENT_TIME_LINE_COLOR}`
                                }}
                            ></div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      );
  };

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate);
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card-bg)' }}>
                {weekDays.map(d => (
                    <div key={d} style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{d}</div>
                ))}
            </div>
            
            {/* Grid */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(100px, 1fr)', overflowY: 'auto' }}>
                {days.map((dayObj, i) => {
                    const { start: dayStart, end: dayEnd } = getDayBounds(dayObj.date);
                    const dayEvents = events.filter(e => {
                        const eventStart = new Date(e.start_time);
                        const eventEnd = new Date(e.end_time);
                        return eventStart < dayEnd && eventEnd > dayStart;
                    });
                    
                    return (
                        <div key={i} 
                            onClick={() => {
                                const start = new Date(dayObj.date);
                                start.setHours(9, 0, 0, 0); // Default 9 AM
                                const end = new Date(start);
                                end.setHours(10, 0, 0, 0);
                                openModalWithTimes(start, end);
                            }}
                            style={{ 
                            borderRight: '1px solid var(--border)', 
                            borderBottom: '1px solid var(--border)', 
                            padding: '5px',
                            backgroundColor: dayObj.isCurrentMonth ? 'transparent' : 'var(--accent-weak)',
                            overflow: 'hidden',
                            minHeight: '100px'
                        }}>
                            <div style={{ 
                                marginBottom: '5px', 
                                color: isSameDate(dayObj.date, new Date()) ? 'var(--accent)' : 'inherit', 
                                fontWeight: isSameDate(dayObj.date, new Date()) ? 'bold' : 'normal',
                                backgroundColor: isSameDate(dayObj.date, new Date()) ? 'var(--accent-weak)' : 'transparent',
                                borderRadius: '50%',
                                display: 'inline-block',
                                width: '24px',
                                height: '24px',
                                lineHeight: '24px',
                                textAlign: 'center',
                                float: 'right'
                            }}>
                                {dayObj.date.getDate()}
                            </div>
                            <div style={{ clear: 'both', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {dayEvents.map(ev => (
                                    <div 
                                        key={ev.id} 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openModalEdit(ev);
                                        }}
                                        style={{ 
                                            backgroundColor: ev.color || 'var(--accent)', 
                                            borderRadius: '3px', 
                                            padding: '2px 4px', 
                                            fontSize: '0.75rem', 
                                            whiteSpace: 'nowrap', 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis',
                                            cursor: 'pointer',
                                            color: 'white'
                                        }} 
                                        title={ev.title}
                                    >
                                        {new Date(ev.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} {ev.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  const getModalButtonStyle = (variant: 'delete' | 'cancel' | 'save') => {
      const isHovered = hoveredModalButton === variant;

      if (variant === 'delete') {
          return {
              padding: '10px 20px',
              background: '#590902',
              border: 'none',
              color: 'white',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
              transform: isHovered ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
              boxShadow: isHovered ? '0 8px 18px rgba(89, 9, 2, 0.45)' : 'none',
              transition: 'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease',
              filter: isHovered ? 'brightness(1.1)' : 'brightness(1)'
          };
      }

      if (variant === 'cancel') {
          return {
              padding: '10px 20px',
              background: isHovered ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
              transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: isHovered ? '0 6px 14px rgba(0, 0, 0, 0.22)' : 'none',
              transition: 'transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease'
          };
      }

      return {
          padding: '10px 20px',
          background: 'var(--accent)',
          border: 'none',
          color: 'white',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 500,
          transform: isHovered ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
          boxShadow: isHovered ? '0 8px 18px rgba(59, 130, 246, 0.4)' : 'none',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease',
          filter: isHovered ? 'brightness(1.08)' : 'brightness(1)'
      };
  };

  const getModalInputStyle = (field: 'title' | 'start' | 'end') => {
      const isActive = activeInputField === field;
      return {
          width: '100%',
          padding: '10px',
          backgroundColor: 'var(--bg-color)',
          border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
          color: 'white',
          borderRadius: '6px',
          transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
          boxShadow: isActive ? '0 8px 18px rgba(59, 130, 246, 0.2)' : 'none',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease'
      };
  };

  return (
    <div className="calendar-container" style={{ height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', color: 'var(--text-primary)', backgroundColor: 'var(--bg-color)' }}>
      {/* Heavy Header */}
      <header style={{ padding: '20px', borderBottom: '1px solid var(--card-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button 
                onClick={() => navigate('/')} 
                className="back-btn" 
                style={{ 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    backgroundColor: 'var(--card-bg)', 
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}
            >
                <img src={arrowIcon} alt="Back" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
                Back
            </button>
            <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={calendarIcon} alt="Calendar" style={{ width: '26px', height: '26px', borderRadius: '6px' }} />
                Calendar
            </h1>
            <div className="view-controls" style={{ display: 'flex', gap: '5px', backgroundColor: 'var(--card-bg)', padding: '4px', borderRadius: '6px' }}>
                {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
                    <button 
                        key={mode} 
                        onClick={() => {
                            setViewMode(mode);
                            if (mode === 'day') setCurrentDate(new Date());
                        }} 
                        style={{ 
                            padding: '6px 16px', 
                            background: viewMode === mode ? 'var(--accent)' : 'transparent', 
                            border: 'none', 
                            borderRadius: '4px', 
                            color: viewMode === mode ? 'white' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            fontWeight: viewMode === mode ? 'bold' : 'normal',
                            transition: 'all 0.2s'
                        }}
                    >
                        {mode}
                    </button>
                ))}
            </div>
        </div>
        <div className="nav-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <button onClick={handleCreateEventClick} style={{ background: '#22c55e', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}><span>+</span> New Event</button>
             <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--card-bg)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                 <button onClick={handlePrev} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px 12px', cursor: 'pointer', borderRight: '1px solid var(--border)' }}>&lt;</button>
                 <span style={{ fontWeight: '600', padding: '0 15px', minWidth: '180px', textAlign: 'center', fontSize: '0.95rem' }}>
                     {viewMode === 'month' 
                        ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                        : `${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${viewMode === 'week' ? ` - ${getEndOfWeek(currentDate).getDate()}` : ''}`
                     }
                 </span>
                 <button onClick={handleNext} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px 12px', cursor: 'pointer', borderLeft: '1px solid var(--border)' }}>&gt;</button>
             </div>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'day' && renderWeekView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'month' && renderMonthView()}
      </div>


      {isModalOpen && (
          <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
              backdropFilter: 'blur(2px)'
          }}>
              <div style={{ backgroundColor: 'var(--card-bg)', padding: '24px', borderRadius: '12px', width: '400px', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.25rem' }}>{modalMode === 'create' ? 'Create Event' : 'Edit Event'}</h3>
                  <form onSubmit={handleSaveEvent}>
                      <div style={{ marginBottom: '15px' }}>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Title</label>
                          <input 
                            type="text" 
                            value={newEventTitle} 
                            onChange={e => setNewEventTitle(e.target.value)} 
                                                        onMouseEnter={() => setActiveInputField('title')}
                                                        onMouseLeave={() => setActiveInputField(null)}
                                                        onFocus={() => setActiveInputField('title')}
                                                        onBlur={() => setActiveInputField(null)}
                                                        style={getModalInputStyle('title')}
                            placeholder="Meeting with team..."
                            required
                          />
                      </div>
                      <div style={{ marginBottom: '15px' }}>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Start Time</label>
                          <input 
                            type="datetime-local" 
                            value={newEventStart}
                            onChange={e => setNewEventStart(e.target.value)}
                                                        onMouseEnter={() => setActiveInputField('start')}
                                                        onMouseLeave={() => setActiveInputField(null)}
                                                        onFocus={() => setActiveInputField('start')}
                                                        onBlur={() => setActiveInputField(null)}
                                                        style={getModalInputStyle('start')}
                            required
                          />
                      </div>
                      <div style={{ marginBottom: '25px' }}>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>End Time</label>
                          <input 
                            type="datetime-local" 
                            value={newEventEnd}
                            onChange={e => setNewEventEnd(e.target.value)}
                                                        onMouseEnter={() => setActiveInputField('end')}
                                                        onMouseLeave={() => setActiveInputField(null)}
                                                        onFocus={() => setActiveInputField('end')}
                                                        onBlur={() => setActiveInputField(null)}
                                                        style={getModalInputStyle('end')}
                            required
                          />
                      </div>
                      <div style={{ marginBottom: '25px' }}>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Color</label>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input 
                                type="color" 
                                value={newEventColor}
                                onChange={e => setNewEventColor(e.target.value)}
                                style={{ width: '60px', height: '40px', padding: '0', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                {['var(--accent)', 'var(--error)', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'].map(c => (
                                    <div 
                                        key={c}
                                        onClick={() => setNewEventColor(c)}
                                        onMouseEnter={() => setHoveredColorSwatch(c)}
                                        onMouseLeave={() => setHoveredColorSwatch(null)}
                                        style={{ 
                                            width: '32px', height: '32px', borderRadius: '50%', backgroundColor: c, cursor: 'pointer',
                                            border: newEventColor === c ? '2px solid white' : '2px solid transparent',
                                            transform: hoveredColorSwatch === c ? 'translateY(-2px) scale(1.07)' : 'translateY(0) scale(1)',
                                            boxShadow: hoveredColorSwatch === c ? '0 8px 16px rgba(0, 0, 0, 0.28)' : 'none',
                                            transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease'
                                        }}
                                    />
                                ))}
                            </div>
                          </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                          <div>
                              {modalMode === 'edit' && (
                                  <button
                                      type="button"
                                      onClick={handleDeleteEvent}
                                      onMouseEnter={() => setHoveredModalButton('delete')}
                                      onMouseLeave={() => setHoveredModalButton(null)}
                                      style={getModalButtonStyle('delete')}
                                  >
                                      Delete Event
                                  </button>
                              )}
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                              <button
                                  type="button"
                                  onClick={() => setIsModalOpen(false)}
                                  onMouseEnter={() => setHoveredModalButton('cancel')}
                                  onMouseLeave={() => setHoveredModalButton(null)}
                                  style={getModalButtonStyle('cancel')}
                              >
                                  Cancel
                              </button>
                              <button
                                  type="submit"
                                  onMouseEnter={() => setHoveredModalButton('save')}
                                  onMouseLeave={() => setHoveredModalButton(null)}
                                  style={getModalButtonStyle('save')}
                              >
                                  Save Event
                              </button>
                          </div>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
