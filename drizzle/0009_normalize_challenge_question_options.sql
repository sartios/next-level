-- Custom SQL migration file, put your code below! ---- Normalize challenge_questions.options from object shape {"A":"...","B":"...","C":"...","D":"..."}
-- to array shape [{"label":"A","text":"..."},{"label":"B","text":"..."},...]
-- Only updates rows where options is a JSON object (not already an array).
UPDATE challenge_questions
SET options = jsonb_build_array(
  jsonb_build_object('label', 'A', 'text', options->>'A'),
  jsonb_build_object('label', 'B', 'text', options->>'B'),
  jsonb_build_object('label', 'C', 'text', options->>'C'),
  jsonb_build_object('label', 'D', 'text', options->>'D')
)
WHERE jsonb_typeof(options) = 'object';