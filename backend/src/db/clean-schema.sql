CREATE TABLE IF NOT EXISTS app_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  app_name TEXT NOT NULL DEFAULT 'Idea Courses',
  instructor_name TEXT NOT NULL DEFAULT 'بشمهندس ميدو شلبي',
  welcome_subtitle TEXT NOT NULL DEFAULT 'منصة المحاضرات التفاعلية المحمية للكمبيوتر والموبايل',
  whatsapp_number TEXT NOT NULL DEFAULT '201026533835',
  instapay_address TEXT NOT NULL DEFAULT '01026533835',
  wallet_number TEXT NOT NULL DEFAULT '01026533835',
  payment_holder_name TEXT NOT NULL DEFAULT 'بشمهندس ميدو شلبي',
  max_devices INT NOT NULL DEFAULT 1,
  desktop_mobile_only BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  is_banned BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  last_platform TEXT DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  device_label TEXT NOT NULL DEFAULT '',
  hw_short TEXT NOT NULL DEFAULT '',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS app_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'عام',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  thumbnail_url TEXT NOT NULL DEFAULT '',
  intro_youtube_url TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT true,
  max_views_per_lesson INT NOT NULL DEFAULT 0,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES app_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES app_courses(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES app_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT NOT NULL,
  duration_label TEXT NOT NULL DEFAULT '',
  attachment_url TEXT NOT NULL DEFAULT '',
  is_free_preview BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES app_courses(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS app_lesson_progress (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES app_lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES app_courses(id) ON DELETE CASCADE,
  watched_seconds INT NOT NULL DEFAULT 0,
  last_position_seconds INT NOT NULL DEFAULT 0,
  views_count INT NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS app_activation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  course_id UUID NOT NULL REFERENCES app_courses(id) ON DELETE CASCADE,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  data_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES app_courses(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('instapay', 'wallet')),
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  sender_phone TEXT NOT NULL DEFAULT '',
  receipt_url TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_youtube_connection (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  client_id TEXT NOT NULL DEFAULT '',
  client_secret TEXT NOT NULL DEFAULT '',
  access_token TEXT NOT NULL DEFAULT '',
  refresh_token TEXT NOT NULL DEFAULT '',
  token_expires_at TIMESTAMPTZ,
  channel_id TEXT NOT NULL DEFAULT '',
  channel_title TEXT NOT NULL DEFAULT '',
  channel_thumbnail TEXT NOT NULL DEFAULT '',
  default_privacy TEXT NOT NULL DEFAULT 'unlisted',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_youtube_connection (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_bunny_connection (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  library_id TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  token_auth_key TEXT NOT NULL DEFAULT '',
  cdn_hostname TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_bunny_connection (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_app_sections_course ON app_sections(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_app_lessons_course ON app_lessons(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_app_enrollments_user ON app_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_app_progress_user ON app_lesson_progress(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_app_payments_status ON app_payment_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_payments_user ON app_payment_requests(user_id, course_id);
