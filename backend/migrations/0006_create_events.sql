-- Drop the old events table from 0001_initial_setup.sql as it lacks many required fields and user association
DROP TABLE IF EXISTS events CASCADE;

-- Recreate with full RFC 5545 support and user ownership
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    original_tz TEXT NOT NULL DEFAULT 'UTC',
    status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed, tentative, cancelled
    transparency TEXT NOT NULL DEFAULT 'opaque', -- opaque (busy), transparent (free)
    visibility TEXT NOT NULL DEFAULT 'private', -- public, private, confidential
    rrule TEXT, -- RFC 5545 recurrence rule
    exdates TEXT[], -- Array of excluded dates (ISO 8601 strings)
    parent_event_id UUID REFERENCES events(id) ON DELETE CASCADE, -- For recurring event exceptions
    recurrence_id TIMESTAMPTZ, -- The original start time of the instance being modified
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX events_user_id_idx ON events(user_id);
CREATE INDEX events_start_time_idx ON events(start_time);
CREATE INDEX events_end_time_idx ON events(end_time);
