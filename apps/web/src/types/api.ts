// Kiểu dữ liệu viết tay theo hợp đồng API trong tài liệu kiến trúc.
// Khi backend FastAPI sẵn sàng, thay bằng file sinh từ OpenAPI (src/types/api.d.ts).

export type Role = "student" | "teacher" | "admin" | "parent";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  grade: number | null;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
  /** Đăng ký công khai: học sinh (bắt buộc chọn lớp) hoặc phụ huynh. */
  role?: "student" | "parent";
  grade?: number | null;
}

export interface Skill {
  code: string;
  name: string;
}

export type AnswerType = "choice" | "number" | "set";

/** `content` là văn bản có thể chứa công thức trong `$...$`. */
export interface Choice {
  key: string;
  content: string;
}

/** Bài toán ở dạng công khai: không có đáp án và lời giải. */
export interface PublicProblem {
  id: string;
  statement: string;
  grade: number;
  skill: Skill;
  difficulty: number;
  answer_type: AnswerType;
  /** LaTeX đứng trước ô nhập, ví dụ `x =`. */
  answer_prefix?: string;
  choices?: Choice[];
  /** Gợi ý theo từng bước, mở lần lượt. */
  hints?: string[];
}

export type AnswerValue =
  | { type: "choice"; value: string }
  | { type: "number"; value: string }
  | { type: "set"; value: string[] };

export interface AttemptRequest {
  client_attempt_id: string;
  problem_id: string;
  answer: AnswerValue;
  time_ms: number;
  /** Số gợi ý đã mở; backend giảm mức tăng điểm kỹ năng khi > 0. */
  hints_used: number;
}

export interface AttemptResult {
  attempt_id: string;
  is_correct: boolean;
  correct_answer: AnswerValue;
  correct_answer_display: string;
  solution: string[];
  /** XP nhận được (gồm thưởng mục tiêu ngày và nhiệm vụ vừa xong). */
  xp_gained?: number;
}

export interface SkillScore extends Skill {
  score: number;
  n_attempts: number;
}

export interface Progress {
  skills: SkillScore[];
  total_attempts: number;
  correct_attempts: number;
  daily_goal: number;
  today_attempts: number;
  /** Số ngày liên tiếp đạt mục tiêu (tính cả hôm nay nếu đã đạt). */
  streak_days: number;
}

export interface AttemptSummary {
  id: string;
  problem_id: string;
  statement: string;
  skill: Skill;
  is_correct: boolean;
  created_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
}

export interface VerificationCheck {
  label: string;
  passed: boolean;
}

export interface ReviewItem {
  id: string;
  origin: "generated" | "extracted";
  statement: string;
  answer_display: string;
  solution: string[];
  grade: number;
  skill: Skill;
  difficulty: number;
  classification_confidence: number;
  parent?: { id: string; statement: string };
  transform?: string;
  source?: { name: string; page: number };
  choices?: Choice[];
  checks: VerificationCheck[];
}

// ---- Làm đề

/** choice: Phần I (A/B/C/D) + Phần II (Đúng/Sai). written: tự luận điền đáp số. */
export type ExamMode = "choice" | "written";
/** practice: đề ôn tập tự chọn. official: đề thi theo cấu trúc chuẩn của Bộ GD&ĐT. */
export type ExamKind = "practice" | "official";
/** Cấu trúc đề thi chính thức. Hiện có: tốt nghiệp THPT (từ 2025). */
export type ExamBlueprint = "thpt";
export type ExamQuestionType = "choice" | "true_false" | "number";

/** Dạng bài (template của bộ sinh đề), dùng để tạo đề mới từ các dạng đã sai. */
export interface TemplateRef {
  code: string;
  name: string;
}

export interface TFStatement {
  key: string;
  content: string;
}

export interface ExamQuestion {
  id: string;
  index: number;
  type: ExamQuestionType;
  template: TemplateRef;
  skill: Skill;
  grade: number;
  difficulty: number;
  statement: string;
  choices?: Choice[];
  /** Với câu Đúng/Sai: 4 ý a, b, c, d. */
  statements?: TFStatement[];
  answer_prefix?: string;
}

export type ExamAnswer =
  | { type: "choice"; value: string }
  | { type: "number"; value: string }
  | { type: "true_false"; value: Record<string, boolean> };

export interface ExamResultItem {
  question_id: string;
  is_correct: boolean;
  /** Điểm của câu (0–1). Đúng/Sai chấm từng phần: 1 ý 0,1 · 2 ý 0,25 · 3 ý 0,5 · 4 ý 1. */
  points: number;
  correct_answer: ExamAnswer;
  correct_answer_display: string;
  solution: string[];
}

export interface ExamResult {
  correct: number;
  total: number;
  /** Thang điểm 10. */
  score: number;
  /** Điểm từng phần (đề thi chính thức). */
  parts: { label: string; earned: number; max: number }[];
  items: ExamResultItem[];
  wrong_templates: TemplateRef[];
  submitted_at: string;
}

export interface Exam {
  id: string;
  title: string;
  kind: ExamKind;
  mode: ExamMode;
  size: number;
  created_at: string;
  duration_minutes: number | null;
  /** Hạn nộp do server tính; đồng hồ đếm ngược dựa vào đây, không dựa vào giờ máy học sinh. */
  ends_at: string | null;
  questions: ExamQuestion[];
  result: ExamResult | null;
  /** Đề của bài giao trong lớp (nếu có). */
  assignment_id?: string | null;
  /** Bài làm của học sinh, chỉ có sau khi nộp. */
  answers?: Record<string, ExamAnswer> | null;
}

export interface ExamSummary {
  id: string;
  title: string;
  kind: ExamKind;
  mode: ExamMode;
  size: number;
  created_at: string;
  score: number | null;
  correct: number | null;
}

export interface CreateExamRequest {
  kind?: ExamKind;
  blueprint?: ExamBlueprint;
  mode?: ExamMode;
  size?: number;
  skills?: string[];
  /** Chỉ sinh câu thuộc các dạng này (tạo đề từ dạng đã sai). */
  templates?: string[];
  /** Làm lại các câu sai của đề này. */
  retry_of?: string;
}

export interface SubmitExamRequest {
  answers: Record<string, ExamAnswer>;
}

// ---- Tải đề & sinh câu hỏi

export type IngestionStepKey = "upload" | "extract" | "split" | "recognize" | "verify";

export interface IngestionStep {
  key: IngestionStepKey;
  label: string;
  state: "pending" | "running" | "done" | "failed";
}

export interface RuleOption {
  code: string;
  label: string;
  description: string;
}

/** Bài toán ở dạng có cấu trúc, ví dụ ax^2 + bx + c = 0 với a = 1, b = -5, c = 6. */
export interface RecognizedStructure {
  kind: string;
  kind_label: string;
  general_form: string;
  params: { name: string; value: string }[];
  /** Dạng chuẩn sau khi quy đồng, rút gọn (LaTeX). */
  canonical: string;
  /** Mã băm của dạng chuẩn, dùng để chống trùng. */
  hash: string;
}

export interface ExtractedItem {
  id: string;
  index: number;
  raw_text: string;
  /** Đề đã bọc công thức vào $...$ để hiển thị. */
  statement: string;
  choices: Choice[];
  status: "recognized" | "unrecognized";
  reason: string | null;
  structure: RecognizedStructure | null;
  answer_display: string | null;
  solution: string[];
  grade: number | null;
  skill: Skill | null;
  difficulty: number | null;
  confidence: number;
  checks: VerificationCheck[];
  duplicate_of: string | null;
  /** Phương án trong đề khớp với lời giải (nếu đề có A/B/C/D). */
  matched_choice: string | null;
  rules: RuleOption[];
}

export interface IngestionStats {
  total: number;
  recognized: number;
  duplicates: number;
}

export interface IngestionSource {
  id: string;
  name: string;
  origin: "file" | "text";
  status: "processing" | "done" | "failed";
  steps: IngestionStep[];
  created_at: string;
  error: string | null;
  items: ExtractedItem[];
  stats: IngestionStats;
}

export interface IngestionSourceSummary {
  id: string;
  name: string;
  origin: "file" | "text";
  status: IngestionSource["status"];
  created_at: string;
  stats: IngestionStats;
}

export interface UploadUrlRequest {
  filename: string;
  content_type: string;
  size: number;
}

export interface UploadUrlResponse {
  upload_url: string;
  file_key: string;
}

export interface CreateSourceRequest {
  name: string;
  file_key?: string;
  text?: string;
}

export type DifficultyTarget = "easier" | "same" | "harder";
/** original: giữ kiểu tự luận · choice: trắc nghiệm A/B/C/D · short: trả lời ngắn một đáp số. */
export type VariantFormat = "original" | "choice" | "short";

export interface GenerateVariantsRequest {
  item_id: string;
  count: number;
  rules: string[];
  target: DifficultyTarget;
  format: VariantFormat;
}

export interface Variant {
  id: string;
  item_id: string;
  statement: string;
  format: VariantFormat;
  choices: Choice[];
  answer_display: string;
  answer_short: string | null;
  answer_prefix: string | null;
  solution: string[];
  rule: RuleOption;
  transform: string;
  grade: number;
  skill: Skill;
  difficulty: number;
  checks: VerificationCheck[];
  /** Qua mọi bước kiểm chứng và không trùng. */
  accepted: boolean;
}

export interface SubmitVariantsRequest {
  variant_ids: string[];
}

export type ReviewDecision = { decision: "approve" } | { decision: "reject"; reason: string };

// ---- Lớp học & bài giao

export interface ClassRoom {
  id: string;
  name: string;
  grade: number | null;
  teacher_name: string;
  /** Chỉ giáo viên của lớp mới thấy. */
  join_code?: string;
  member_count: number;
  assignment_count: number;
  /** Học sinh: số bài chưa làm và còn hạn. */
  pending_count: number;
  created_at: string;
}

export interface ClassMember {
  id: string;
  full_name: string;
  email: string;
  grade: number | null;
  joined_at: string;
}

export interface ClassDetail extends ClassRoom {
  /** Chỉ giáo viên của lớp mới thấy. */
  members?: ClassMember[];
}

export interface CreateClassRequest {
  name: string;
  grade?: number | null;
}

/** todo: chưa làm · in_progress: đang làm · submitted: đã nộp · late: nộp sau hạn · missed: quá hạn, chưa nộp. */
export type AssignmentStatus = "todo" | "in_progress" | "submitted" | "late" | "missed";

export interface Assignment {
  id: string;
  class_id: string;
  class_name: string;
  title: string;
  kind: ExamKind;
  mode: ExamMode;
  size: number;
  duration_minutes: number | null;
  due_at: string | null;
  shuffle: boolean;
  created_at: string;
  // Giáo viên
  member_count?: number;
  submitted_count?: number;
  average_score?: number | null;
  // Học sinh
  status?: AssignmentStatus;
  exam_id?: string | null;
  score?: number | null;
}

export interface CreateAssignmentRequest {
  title?: string;
  kind: ExamKind;
  mode?: ExamMode;
  size?: number;
  skills?: string[];
  /** Giao bộ đề giáo viên đã soạn (bỏ qua hình thức / số câu / chủ đề). */
  problem_set_id?: string;
  duration_minutes?: number | null;
  due_at?: string | null;
  shuffle?: boolean;
}

export interface StudentResult {
  id: string;
  full_name: string;
  status: AssignmentStatus;
  exam_id: string | null;
  score: number | null;
  correct: number | null;
  total: number;
  started_at: string | null;
  submitted_at: string | null;
  duration_seconds: number | null;
}

export interface QuestionStat {
  index: number;
  type: ExamQuestionType;
  statement: string;
  template: TemplateRef;
  skill: Skill;
  answer_display: string;
  /** Tỉ lệ điểm trung bình của câu (0–1) trong số bài đã nộp. */
  correct_rate: number | null;
  answered: number;
}

export interface AssignmentReport {
  assignment: Assignment;
  summary: {
    member_count: number;
    submitted_count: number;
    late_count: number;
    average_score: number | null;
    max_score: number | null;
    min_score: number | null;
    /** Số bài theo khoảng điểm [0,2) [2,4) [4,6) [6,8) [8,10]. */
    distribution: number[];
  };
  students: StudentResult[];
  questions: QuestionStat[];
  skills: { skill: Skill; questions: number; correct_rate: number | null }[];
}

export interface LeaderboardRow {
  id: string;
  full_name: string;
  is_me: boolean;
  average_score: number | null;
  assignments_done: number;
  /** Số bài đã làm trong 7 ngày gần nhất. */
  week_problems: number;
  streak_days: number;
}

// ---- Bộ đề của giáo viên

/** Dạng bài của bộ sinh đề (GET /exams/templates). */
export interface TemplateInfo {
  code: string;
  name: string;
  skill: string;
  grade: number;
  difficulty: number;
  mode: ExamMode;
  type: ExamQuestionType;
  /** Phần trong đề thi THPT (I/II/III); dạng của đề ôn tập không có. */
  part?: string;
}

/** Câu trong bộ đề: giáo viên thấy cả đáp án và lời giải. */
export interface SetQuestion extends Omit<ExamQuestion, "id" | "index"> {
  key: string;
  answer: ExamAnswer;
  answer_display: string;
  solution: string[];
}

export interface ProblemSetSummary {
  id: string;
  title: string;
  description: string | null;
  size: number;
  counts: Record<ExamQuestionType, number>;
  skills: Skill[];
  created_at: string;
  updated_at: string;
}

export interface ProblemSet extends ProblemSetSummary {
  questions: SetQuestion[];
}

export interface TemplateCount {
  template: string;
  count: number;
}

export interface UpdateProblemSetRequest {
  title?: string;
  description?: string | null;
  /** Thứ tự mới theo `key`; câu không có trong danh sách bị xóa. */
  order?: string[];
}

// ---- Đấu trường

/** basic: Đại số lớp 8–10 · thpt: ôn thi tốt nghiệp THPT. */
export type ArenaPool = "basic" | "thpt";
export type ArenaDuration = 5 | 15 | 30;

export interface ArenaItem {
  statement: string;
  template: TemplateRef;
  given?: ExamAnswer;
  is_correct: boolean;
  points: number;
  answer_display: string;
}

export interface ArenaRun {
  id: string;
  pool: ArenaPool;
  duration_minutes: ArenaDuration;
  started_at: string;
  /** Server giữ giờ kết thúc; câu trả lời gửi sau giờ không được chấm. */
  ends_at: string;
  finished: boolean;
  score: number;
  correct: number;
  answered: number;
  combo: number;
  best_combo: number;
  question?: ExamQuestion;
  // Sau khi kết thúc
  history?: ArenaItem[];
  week_rank?: number;
  personal_best?: boolean;
}

export interface ArenaAnswerResult {
  is_correct: boolean;
  points: number;
  correct_answer: ExamAnswer;
  correct_answer_display: string;
  run: ArenaRun;
}

export interface ArenaBoardRow {
  rank: number;
  user_id: string;
  full_name: string;
  grade: number | null;
  score: number;
  correct: number;
  answered: number;
  is_me: boolean;
}

export interface ArenaBoard {
  rows: ArenaBoardRow[];
  /** Hạng của tôi khi không nằm trong danh sách. */
  me: ArenaBoardRow | null;
}

export interface ArenaBest {
  pool: ArenaPool;
  duration_minutes: ArenaDuration;
  score: number;
}

export interface ArenaMe {
  best: ArenaBest[];
  recent: { id: string; pool: ArenaPool; duration_minutes: ArenaDuration; score: number; correct: number; answered: number; finished_at: string }[];
  active_run_id: string | null;
}

// ---- Phụ huynh

export interface LinkCode {
  code: string;
  expires_at: string;
}

export interface LinkedParent {
  id: string;
  full_name: string;
  email: string;
  linked_at: string;
}

export interface ChildSummary {
  id: string;
  full_name: string;
  grade: number | null;
  linked_at: string;
  daily_goal: number;
  today_problems: number;
  week_problems: number;
  streak_days: number;
  pending_assignments: number;
  missed_assignments: number;
  last_active: string | null;
}

export interface ChildReport {
  child: ChildSummary;
  progress: Progress;
  /** 14 ngày gần nhất, cũ → mới. */
  activity: { day: string; count: number }[];
  exams: ExamSummary[];
  assignments: Assignment[];
  arena: ArenaBest[];
}

// ---- Phần thưởng: XP, nhiệm vụ hằng ngày, đóng băng chuỗi, huy hiệu

export interface Quest {
  code: string;
  title: string;
  target: number;
  progress: number;
  reward: number;
  done: boolean;
}

export interface BadgeInfo {
  code: string;
  title: string;
  description: string;
  earned_at: string | null;
}

export interface CalendarDay {
  day: string;
  count: number;
  status: "met" | "frozen" | "partial" | "none";
}

export interface Rewards {
  today: string;
  xp_total: number;
  xp_today: number;
  daily_goal: number;
  today_attempts: number;
  streak_days: number;
  longest_streak: number;
  freezes: number;
  max_freezes: number;
  freeze_every: number;
  quests: Quest[];
  badges: BadgeInfo[];
  calendar: CalendarDay[];
}
