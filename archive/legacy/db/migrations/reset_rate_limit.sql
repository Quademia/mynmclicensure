-- ============================================================
-- Migration: reset_requests table + rate limiting RPCs
-- Run this in Supabase SQL Editor (one-time)
-- ============================================================

-- 1. Create the reset_requests table
CREATE TABLE reset_requests (
  request_id    TEXT PRIMARY KEY,
  email         TEXT NOT NULL,            -- what the user typed (lowercased)
  user_exists   BOOLEAN NOT NULL DEFAULT FALSE,  -- was this a registered email
  status        TEXT NOT NULL,            -- EMAIL_SENT | RATE_LIMITED | EMAIL_FAILED
  fp_hash       TEXT,                     -- device fingerprint hash
  device_label  TEXT,                     -- 'Windows · Chrome' etc.
  used          BOOLEAN NOT NULL DEFAULT FALSE,  -- did they complete the reset
  used_utc      TIMESTAMPTZ,             -- when they completed it
  created_utc   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX reset_requests_email_created
  ON reset_requests (email, created_utc);

CREATE INDEX reset_requests_created
  ON reset_requests (created_utc);

-- 3. Lock down with RLS (no direct browser access)
ALTER TABLE reset_requests ENABLE ROW LEVEL SECURITY;

-- 4. RPC: check_reset_rate_limit
-- Counts non-rate-limited requests for an email in the last 60 min.
-- Threshold: 3 requests per email per 60 minutes.
CREATE OR REPLACE FUNCTION check_reset_rate_limit(
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email   TEXT := LOWER(TRIM(p_email));
  v_now     TIMESTAMPTZ := NOW();
  v_60m_ago TIMESTAMPTZ := v_now - INTERVAL '60 minutes';
  v_count   INT;
  v_oldest  TIMESTAMPTZ;
  v_retry   INT;
BEGIN
  SELECT COUNT(*), MIN(created_utc)
  INTO v_count, v_oldest
  FROM reset_requests
  WHERE email = v_email
    AND status != 'RATE_LIMITED'
    AND created_utc > v_60m_ago;

  IF v_count >= 3 THEN
    v_retry := GREATEST(
      EXTRACT(EPOCH FROM (v_oldest + INTERVAL '60 minutes' - v_now))::INT,
      60
    );
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', v_retry,
      'reason', 'TOO_MANY_RESET_REQUESTS'
    );
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- 5. RPC: log_reset_request
-- Inserts a row into reset_requests. Checks if the email exists
-- in the users table server-side so the browser never knows.
CREATE OR REPLACE FUNCTION log_reset_request(
  p_request_id   TEXT,
  p_email        TEXT,
  p_status       TEXT,
  p_fp_hash      TEXT DEFAULT NULL,
  p_device_label TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email       TEXT := LOWER(TRIM(p_email));
  v_user_exists BOOLEAN;
BEGIN
  IF p_status NOT IN ('EMAIL_SENT', 'RATE_LIMITED', 'EMAIL_FAILED') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM users WHERE LOWER(email) = v_email
  ) INTO v_user_exists;

  INSERT INTO reset_requests (
    request_id, email, user_exists, status,
    fp_hash, device_label
  ) VALUES (
    p_request_id,
    v_email,
    v_user_exists,
    p_status,
    p_fp_hash,
    p_device_label
  );
END;
$$;

-- 6. RPC: mark_reset_used
-- Called after a successful password reset. Marks the most recent
-- EMAIL_SENT request for that email as used.
CREATE OR REPLACE FUNCTION mark_reset_used(
  p_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT := LOWER(TRIM(p_email));
BEGIN
  UPDATE reset_requests
  SET used = TRUE,
      used_utc = NOW()
  WHERE request_id = (
    SELECT request_id
    FROM reset_requests
    WHERE email = v_email
      AND status = 'EMAIL_SENT'
      AND used = FALSE
    ORDER BY created_utc DESC
    LIMIT 1
  );
END;
$$;

-- 7. Revert log_auth_event back to login-only
-- (removes RESET_REQUEST that was added earlier)
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
