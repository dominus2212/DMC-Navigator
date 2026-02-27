DELETE FROM users WHERE email='admin@dmc-navigator.local';

INSERT INTO users (id, email, full_name, password_hash, is_platform_admin)
VALUES (
  'usr_platform_1',
  'admin@dmc-navigator.local',
  'Platform Admin',
  'pbkdf2$120000$1xisQoo4H5hlZHfFDlQ8Qw==$VQaWkFJrq1nRH10tA6Be27usShtOXqDiqfgaMPKxWvA=',
  1
);
