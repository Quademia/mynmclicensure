-- ============================================================
-- Migration: auth_events table + rate limiting RPCs
-- Run this in Supabase SQL Editor (one-time)
-- ============================================================

-- 1. Create the auth_events table
CREATE TABLE auth_events (
  event_id      TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  identifier    TEXT NOT NULL,
  user_id       TEXT,
  fp_hash       TEXT,
  ua_hash       TEXT,
  device_label  TEXT,
  fail_reason   TEXT,
  created_utc   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for fast rate-limit queries
CREATE INDEX auth_events_identifier_created
  ON auth_events (identifier, created_utc);

CREATE INDEX auth_events_fp_hash_created
  ON auth_events (fp_hash, created_utc)
  WHERE fp_hash IS NOT NULL;

CREATE INDEX auth_events_user_id_created
  ON auth_events (user_id, created_utc)
  WHERE user_id IS NOT NULL;

CREATE INDEX auth_events_created
  ON auth_events (created_utc);

-- 3. Lock down with RLS (no direct browser access)
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

-- 4. RPC: log_auth_event
-- Inserts one row into auth_events. Called after every login attempt.
CREATE OR REPLACE FUNCTION log_auth_event(
  p_event_id     TEXT,
  p_event_type   TEXT,
  p_identifier   TEXT,
  p_user_id      TEXT    DEFAULT NULL,
  p_fp_hash      TEXT    DEFAULT NULL,
  p_ua_hash      TEXT    DEFAULT NULL,
  p_device_label TEXT    DEFAULT NULL,
  p_fail_reason  TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_event_type NOT IN ('LOGIN_SUCCESS', 'LOGIN_FAIL') THEN
    RAISE EXCEPTION 'Invalid event_type: %', p_event_type;
  END IF;

  INSERT INTO auth_events (
    event_id, event_type, identifier, user_id,
    fp_hash, ua_hash, device_label, fail_reason
  ) VALUES (
    p_event_id,
    p_event_type,
    LOWER(TRIM(p_identifier)),
    p_user_id,
    p_fp_hash,
    p_ua_hash,
    p_device_label,
    p_fail_reason
  );
END;
$$;

-- 5. RPC: check_login_rate_limit
-- Counts recent failures and returns allowed/blocked.
-- Thresholds: 5 fails in 10 min, 10 fails in 24 hr.
CREATE OR REPLACE FUNCTION check_login_rate_limit(
  p_identifier TEXT,
  p_fp_hash    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_identifier   TEXT := LOWER(TRIM(p_identifier));
  v_now          TIMESTAMPTZ := NOW();
  v_10m_ago      TIMESTAMPTZ := v_now - INTERVAL '10 minutes';
  v_24h_ago      TIMESTAMPTZ := v_now - INTERVAL '24 hours';
  v_id_short     INT;
  v_id_long      INT;
  v_fp_short     INT;
  v_fp_long      INT;
  v_oldest_short TIMESTAMPTZ;
  v_oldest_long  TIMESTAMPTZ;
  v_retry        INT;
BEGIN
  SELECT COUNT(*), MIN(created_utc)
  INTO v_id_short, v_oldest_short
  FROM auth_events
  WHERE identifier = v_identifier
    AND event_type = 'LOGIN_FAIL'
    AND fail_reason != 'RATE_LIMITED'
    AND created_utc > v_10m_ago;

  SELECT COUNT(*), MIN(created_utc)
  INTO v_id_long, v_oldest_long
  FROM auth_events
  WHERE identifier = v_identifier
    AND event_type = 'LOGIN_FAIL'
    AND fail_reason != 'RATE_LIMITED'
    AND created_utc > v_24h_ago;

  v_fp_short := 0;
  v_fp_long  := 0;
  IF p_fp_hash IS NOT NULL THEN
    SELECT COUNT(*) INTO v_fp_short
    FROM auth_events
    WHERE fp_hash = p_fp_hash
      AND event_type = 'LOGIN_FAIL'
      AND fail_reason != 'RATE_LIMITED'
      AND created_utc > v_10m_ago;

    SELECT COUNT(*) INTO v_fp_long
    FROM auth_events
    WHERE fp_hash = p_fp_hash
      AND event_type = 'LOGIN_FAIL'
      AND fail_reason != 'RATE_LIMITED'
      AND created_utc > v_24h_ago;
  END IF;

  IF v_id_long >= 10 OR v_fp_long >= 10 THEN
    v_retry := GREATEST(
      EXTRACT(EPOCH FROM (v_oldest_long + INTERVAL '24 hours' - v_now))::INT,
      60
    );
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', v_retry,
      'reason', 'TOO_MANY_ATTEMPTS_24H'
    );
  END IF;

  IF v_id_short >= 5 OR v_fp_short >= 5 THEN
    v_retry := GREATEST(
      EXTRACT(EPOCH FROM (v_oldest_short + INTERVAL '10 minutes' - v_now))::INT,
      30
    );
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', v_retry,
      'reason', 'TOO_MANY_ATTEMPTS'
    );
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;
