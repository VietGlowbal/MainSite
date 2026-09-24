# GlowBal Matching Engine Reuse-First Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Nâng Matching Report hiện tại thành phân tích theo từng tiêu chí của chương trình, có bằng chứng và provenance rõ ràng, đồng thời tái sử dụng toàn bộ Target Profile, Applicant State, Evidence Bank, Personal Report V2, F5 engine, bảng dữ liệu, API và UI đang có.

**Architecture:** Giữ nguyên luồng application-scoped hiện tại và mở rộng theo hướng additive. Target Profile được chuẩn hóa thành tiêu chí; Evidence Bank được truy xuất bằng rule deterministic; hard requirements dùng Academic Analyzer hiện có; semantic criterion reasoning và summary cuối report dùng structured LLM qua runtime hiện có. Kết quả mới chỉ được lưu sau khi cả criterion analysis lẫn AI summary hợp lệ, vào `application_match_analyses.report_v2`, đồng thời duy trì các cột F5/legacy để các consumer cũ tiếp tục hoạt động.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Zod, Supabase/PostgreSQL, OpenAI structured generation runtime hiện có, Vitest, Testing Library, Playwright.

---

## 0. Quyết định kiến trúc bắt buộc

### 0.1. Những gì phải tái sử dụng

| Nhu cầu Matching | Nguồn hiện có phải dùng | Không được tạo bản song song |
|---|---|---|
| Programme truth | `TargetProfile` / `resolveTargetProfile()` trong `src/lib/ai/target-profile/` | Không crawl hoặc tạo target-profile store mới |
| Applicant structured state | `ApplicantAIState`, `AcademicProfile` trong `src/lib/ai/applicant-state/` | Không build candidate model thứ hai |
| Applicant evidence | `EvidenceBank`, `lookupByCriterion()`, `lookupByCompetency()` trong `src/shared/evidence/` | Không tạo evidence DB/index mới |
| Personal context | application-scoped Personal Report V2 và lineage hiện có | Không dùng personal report label như raw evidence |
| Hard academic checks | `assessAcademicRequirements()` trong `src/lib/ai/academic-analysis.ts` | Không để LLM tính/override numeric threshold |
| Structured LLM calls | `generateStructured()` và prompt registry trong `src/lib/ai/runtime/` | Không tạo OpenAI client/runtime mới |
| Programme fit | `assessProgrammeFit()`, `programmeFitSchema`, `F5_ENGINE_VERSION` | Không tạo scoring framework cạnh tranh với F5 |
| Persistence | `application_match_analyses` | Không tạo bảng matching report mới |
| API | `POST /api/applications/[id]/match-insights` và GET/read hiện tại | Không thêm endpoint mới trong scope này |
| UI | canonical Matching Report page và redesign đang có trong `src/features/apply/ui/matching-report/` | Không đập UI hiện có để dựng report page mới |
| Downstream | Strategy và Improvement Tasks đọc F5/legacy fields | Không đổi consumer sang contract mới trong một lần big-bang |

### 0.2. Những gì không làm

- Không embedding.
- Không vector database.
- Không thêm package/dependency.
- Không semantic search service.
- Không gọi LLM với toàn bộ applicant state hoặc toàn bộ Evidence Bank.
- Không xóa `analyzeCourseMatchInsights()` trong đợt triển khai này; giữ làm legacy compatibility cho đến khi V2 ổn định.
- Không backfill giả lineage cho row cũ.
- Không đổi URL, navigation, entitlement, cooldown hoặc ownership model.
- Không sửa/hoàn tác các thay đổi UI đang có nếu chưa xác định chính xác phần nào thuộc user.
- Không gọi score là “admission chance”, “acceptance probability” hoặc dự đoán trúng tuyển.

### 0.3. Invariants cần giữ

1. Mọi read/write mới đều filter bằng cả `application_id` và `user_id`.
2. Một report mới phải trỏ đến đúng `confirmed_snapshot_id`, `source_analysis_version_id`, `source_personal_report_version_id` và `target_profile_version_id` đã dùng.
3. Applicant fact trong output chỉ được tham chiếu đến evidence ID có thật trong tập evidence đã gửi cho reasoner.
4. Target criterion phải giữ `sourceRefs`; criterion không có provenance chỉ được giữ khi có `missingInformation` rõ ràng.
5. `report_only` claim và AI interpretation không được dùng làm direct verified evidence.
6. Hard requirement result từ deterministic analyzer là canonical; LLM chỉ giải thích.
7. Legacy row không có `report_v2` vẫn render được.
8. Row mới phải dual-write `report_v2` và các cột `fit_*`, score, strengths/weaknesses hiện có.
9. Nếu generation lỗi, report hoàn chỉnh trước đó phải được giữ và trả về như hiện tại.
10. Cache/incremental reuse dựa trên content identity, không dựa trên timestamp UI.
11. Mỗi report V2 được regenerate phải có đúng một AI summary call thành công; cache hit được phép trả lại AI summary đã persist mà không gọi model lại.

### 0.4. Worktree safety

Worktree tại thời điểm viết plan đang có thay đổi chưa commit, gồm:

- `src/features/apply/ui/matching-report-view.tsx`
- thư mục mới `src/features/apply/ui/matching-report/`
- `docs/current-status.md`
- các thay đổi/untracked khác không thuộc Matching Engine

Agent triển khai phải làm trong worktree/branch riêng hoặc bảo toàn nguyên trạng các thay đổi này. Trước mỗi commit chỉ `git add` đúng file của task; không dùng `git add .`, `git checkout --`, `git reset --hard` hoặc cleanup untracked files.

---

## 1. Contract V2 đích

Tạo contract mới nhưng không thay contract legacy ngay lập tức.

```ts
type CriterionCategory =
  | 'academic_requirement'
  | 'academic_preparation'
  | 'competency'
  | 'selection_criterion'
  | 'programme_value'
  | 'motivation'
  | 'experience'
  | 'scholarship';

type CriterionImportance = 'critical' | 'high' | 'medium' | 'low';
type RequirementType = 'hard' | 'soft' | 'preference' | 'unknown';
type Alignment = 'strong' | 'moderate' | 'weak' | 'missing';
type EvidenceQuality = 'strong' | 'mixed' | 'weak' | 'none';

type MatchingCriterion = {
  id: string;
  category: CriterionCategory;
  label: string;
  description: string;
  importance: CriterionImportance;
  requirementType: RequirementType;
  sourceRefs: string[];
  sourceText: string | null;
  expectedSignals: string[];
  negativeSignals: string[];
  metadata: {
    importanceSource: 'source' | 'default';
    targetRequirementId: string | null;
  };
};

type MatchingEvidence = {
  id: string;                 // EvidenceBank claim id; never a generated alias
  category: string;
  statement: string;
  sourceRefs: string[];
  interpretationRefs: string[];
  status: 'verified' | 'unverified' | 'conflicting' | 'report_only';
  competencies: string[];
  criteria: string[];
  direct: boolean;
  rankScore: number;
};

type HardRequirementMatch = {
  criterionId: string;
  status:
    | 'meets'
    | 'possibly_meets'
    | 'does_not_meet'
    | 'insufficient_information'
    | 'not_applicable';
  applicantValue: string | number | null;
  requiredValue: string | number | null;
  evidenceIds: string[];
  explanation: string;
};

type FitSignal = {
  criterionId: string;
  category: CriterionCategory;
  criterionLabel: string;
  criterionSourceRefs: string[];
  applicantEvidenceIds: string[];
  directEvidenceIds: string[];
  supportingEvidenceIds: string[];
  alignment: Alignment;
  evidenceQuality: EvidenceQuality;
  reasoning: string;
  missingEvidence: string[];
  confidence: number;         // 0..1, not fit probability
  opportunity: string | null;
  inputHash: string;          // criterion + retrieved evidence + relevant context
};

type MatchingStrength = {
  id: string;
  title: string;
  description: string;
  criterionIds: string[];
  evidenceIds: string[];
  strength: 'high' | 'medium';
  whyItMatters: string;
  positioningUse: string | null;
};

type MatchingGap = {
  id: string;
  type:
    | 'hard_requirement'
    | 'missing_evidence'
    | 'weak_evidence'
    | 'capability_gap'
    | 'academic_gap'
    | 'direction_gap'
    | 'positioning_gap';
  title: string;
  description: string;
  criterionIds: string[];
  currentEvidenceIds: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  fixability: 'high' | 'medium' | 'low';
  evidenceNeeded: string[];
  whyItMatters: string;
  priority: number;
};

type PositioningOpportunity = {
  id: string;
  title: string;
  criterionIds: string[];
  evidenceIds: string[];
  currentInterpretation: string;
  recommendedPositioning: string;
  rationale: string;
  confidence: number;
};

type MatchingSummaryResult = {
  summary: string;
  criterionIds: string[];
  evidenceIds: string[];
};

type MatchingReportV2 = {
  contractVersion: 'matching-report-v2';
  generatedAt: string;
  overall: {
    summary: string;
    summaryCriterionIds: string[];
    summaryEvidenceIds: string[];
    strongestAlignment: string[];
    mostImportantGaps: string[];
    evidenceCoverage: number; // 0..100
    fitScore: number;         // deterministic, 0..100
    fitLabel:
      | 'strong_current_alignment'
      | 'moderate_current_alignment'
      | 'limited_current_alignment';
  };
  criteria: MatchingCriterion[];
  academicRequirements: HardRequirementMatch[];
  programmeAlignment: FitSignal[];
  strengths: MatchingStrength[];
  gaps: MatchingGap[];
  positioningOpportunities: PositioningOpportunity[];
  scholarshipAlignment: {
    criteria: FitSignal[];
    strengths: MatchingStrength[];
    gaps: MatchingGap[];
  } | null;
  programmeFit: ProgrammeFit; // canonical F5 result already used downstream
  dependencyIndex: Record<string, string[]>; // evidence id -> criterion ids
  metadata: {
    matchingEngineVersion: string;
    promptVersion: string;
    criterionPromptVersion: string;
    summaryPromptVersion: string;
    model: string;
    targetProfileVersionId: string;
    personalReportVersionId: string;
    sourceAnalysisVersionId: string;
    confirmedSnapshotId: string;
    evidenceBankVersion: string;
    reusedCriterionIds: string[];
    aiCallCount: {
      criterionBatches: number;
      summary: 1;
    };
  };
};
```

Schema phải dùng Zod và `.strict()` tại boundary LLM/report persistence. Không chấp nhận unknown keys từ model.

---

## Task 1: Khóa hành vi hiện tại bằng characterization tests

**Files:**

- Modify: `src/app/api/applications/[id]/match-insights/route.test.ts`
- Modify: `src/features/apply/domain/ai-reports.test.ts`
- Modify: `src/features/apply/domain/matching-report-presentation.test.ts`
- Modify: `src/features/apply/ui/matching-report-view.test.tsx`
- Reference only: `src/app/api/applications/[id]/match-insights/route.ts`
- Reference only: `src/features/apply/api/ai-reports-repository.ts`

**Step 1: Chạy impact/context trước khi sửa**

Run:

```powershell
C:\Users\ADMIN\.local\bin\semble.exe search "Matching Report generation persistence cache and UI rendering" . --top-k 5 --content code
codegraph explore "analyzeCourseMatchInsights assessProgrammeFit POST match-insights MatchingReportView listMatchingApplications"
```

Expected: thấy route có blast radius MEDIUM, 3 consumer chính và các test nêu trên.

**Step 2: Viết test khóa API contract hiện tại**

Thêm các case:

1. `401` khi chưa auth.
2. `404` khi application không thuộc user.
3. cache hit trả `{ ok: true, cached: true, analysis }`.
4. generation failure trả previous analysis và không insert row lỗi.
5. free cooldown trả đúng field `nextRegenerationAt`.
6. row legacy không có `report_v2` vẫn được parse/render.
7. F5 fields vẫn được trả cho Strategy/Planner.

**Step 3: Sửa mismatch đang có trong test/UI contract**

Route đang trả `nextRegenerationAt`; UI hiện đọc `nextAvailableAt`. Chọn một canonical name là `nextRegenerationAt`, giữ fallback đọc `nextAvailableAt` trong UI một release để không phá response cũ/mock cũ.

**Step 4: Chạy test baseline**

Run:

```powershell
npm test -- src/app/api/applications/[id]/match-insights/route.test.ts src/features/apply/domain/ai-reports.test.ts src/features/apply/domain/matching-report-presentation.test.ts src/features/apply/ui/matching-report-view.test.tsx
```

Expected: PASS. Nếu test mới expose mismatch cooldown thì chỉ sửa đúng mapping field, không refactor route ở task này.

**Step 5: Commit**

```powershell
git add -- 'src/app/api/applications/[id]/match-insights/route.test.ts' 'src/features/apply/domain/ai-reports.test.ts' 'src/features/apply/domain/matching-report-presentation.test.ts' 'src/features/apply/ui/matching-report-view.test.tsx' 'src/features/apply/ui/matching-report-view.tsx'
git commit -m "test: lock matching report compatibility"
```

---

## Task 2: Tạo Matching V2 domain contract và Target Profile normalizer

**Files:**

- Create: `src/lib/ai/matching/domain.ts`
- Create: `src/lib/ai/matching/domain.test.ts`
- Create: `src/lib/ai/matching/criteria.ts`
- Create: `src/lib/ai/matching/criteria.test.ts`
- Reference only: `src/lib/ai/target-profile/domain.ts`

**Step 1: Viết failing schema tests**

Test các invariant:

- `FitSignal` reject confidence ngoài `0..1`.
- reject evidence ID rỗng.
- report bắt buộc đầy đủ lineage.
- scholarship criteria không xuất hiện trong `programmeAlignment`.
- hard criterion không xuất hiện trong semantic criterion batch.
- report reject unknown contract version.

Run:

```powershell
npm test -- src/lib/ai/matching/domain.test.ts
```

Expected: FAIL vì module chưa tồn tại.

**Step 2: Implement schema tối thiểu**

Trong `domain.ts`:

- Export các Zod schema và inferred types trong mục “Contract V2 đích”.
- Export constants:

```ts
export const MATCHING_REPORT_CONTRACT_VERSION = 'matching-report-v2';
export const MATCHING_ENGINE_VERSION = 'matching-v2.0.0';
export const MATCHING_PROMPT_BUNDLE_VERSION = 'matching-prompts-v2.0.0';
```

- Dùng schema `programmeFitSchema` hiện có thay vì mô tả lại F5.
- Không thêm class/service interface.

**Step 3: Viết failing criterion normalization tests**

Fixture `TargetProfile` phải cover:

- academic required criterion;
- competency;
- selection criterion;
- application/document requirement;
- scholarship requirement;
- university value;
- programme theme;
- duplicate labels khác casing;
- source ref bị thiếu nhưng có explicit missing information.

Expected:

- stable ID dựa trên category + source requirement ID, không dựa trên array index;
- `scholarship` tách riêng;
- `academic` có requirement language/required status thành `hard`;
- unknown importance dùng `medium` và `metadata.importanceSource = 'default'`;
- không invent criterion từ `TargetProfile.missingInformation`;
- duplicate chỉ merge khi normalized label + category giống nhau, đồng thời union `sourceRefs`.

**Step 4: Implement `normalizeTargetProfile()`**

Signature:

```ts
export function normalizeTargetProfile(targetProfile: TargetProfile): MatchingCriterion[];
```

Mapping cố định:

| TargetProfile input | Criterion category | Requirement type |
|---|---|---|
| `requirements.category === 'academic'` | `academic_requirement` | `hard` nếu status/label/detail thể hiện required/minimum; ngược lại `unknown` |
| `competency` | `competency` | `soft` |
| `selection` | `selection_criterion` | `soft` |
| `application` | `selection_criterion` | `hard` nếu required document/portfolio; ngược lại `unknown` |
| `scholarship` | `scholarship` | giữ hard/unknown theo source |
| `universityValues[]` | `programme_value` | `preference` |
| `programmeThemes.themes[]` | `academic_preparation` | `soft` |

Rules:

- `expectedSignals` lấy từ normalized tokens của label/detail/theme; không gọi AI.
- Stable slug: lowercase, Unicode normalize, bỏ punctuation, collapse whitespace/hyphen.
- Không tự nâng importance lên `critical` nếu source không nói mandatory/minimum/required.
- `sourceRefs` phải copy từ requirement; values/themes chỉ tạo criterion khi có thể map về source. Nếu TargetProfile hiện không giữ sourceRefs cho value/theme, criterion phải ghi explicit `sourceText`, `importanceSource: 'default'`; không giả source ID.

**Step 5: Chạy tests**

```powershell
npm test -- src/lib/ai/matching/domain.test.ts src/lib/ai/matching/criteria.test.ts
```

Expected: PASS.

**Step 6: Commit**

```powershell
git add -- src/lib/ai/matching/domain.ts src/lib/ai/matching/domain.test.ts src/lib/ai/matching/criteria.ts src/lib/ai/matching/criteria.test.ts
git commit -m "feat: add matching v2 criteria contract"
```

---

## Task 3: Evidence adapter và deterministic retrieval, không embedding

**Files:**

- Create: `src/lib/ai/matching/evidence.ts`
- Create: `src/lib/ai/matching/evidence.test.ts`
- Reference/reuse: `src/shared/evidence/domain.ts`
- Reference/reuse: `src/shared/evidence/retrieval.ts`

**Step 1: Viết failing adapter tests**

Test mapping từ `EvidenceBank.claims`:

- claim ID được giữ nguyên;
- verified/unverified/conflicting/report_only được giữ nguyên;
- `sourceRefs`, `interpretationRefs`, criterion tags và competency tags không bị mất;
- `report_only` có `direct = false`;
- AI-only competency claim có thể làm supporting context nhưng không thành verified direct evidence;
- conflicting claim không được ưu tiên vì nội dung có vẻ mạnh.

**Step 2: Implement adapter tối thiểu**

```ts
export function toMatchingEvidence(bank: EvidenceBank): MatchingEvidence[];
```

Không clone raw applicant state. Evidence Bank là canonical source.

**Step 3: Viết failing retrieval tests**

Các case bắt buộc:

1. Exact criterion tag đứng trước token-only match.
2. Exact competency tag đứng trước generic achievement.
3. Academic criterion không kéo activity không liên quan.
4. Verified claim được quality bonus nhưng không vượt exact relevance.
5. Conflicting/report-only claim bị hạ hạng.
6. Ties được sort bằng evidence ID để output ổn định.
7. `topK` mặc định `6`, clamp `1..10`.
8. Không có tag match vẫn có fallback token overlap trong đúng category.

**Step 4: Implement retrieval**

```ts
export function retrieveEvidenceForCriterion(args: {
  criterion: MatchingCriterion;
  evidenceBank: EvidenceBank;
  topK?: number;
}): MatchingEvidence[];
```

Thứ tự xử lý:

1. Gọi `lookupByCriterion()` cho exact criterion tags.
2. Gọi `lookupByCompetency()` cho expected competency signals.
3. Lọc category-compatible claims từ `EvidenceBank.claims`.
4. Union theo claim ID.
5. Tính deterministic rank.
6. Sort score descending, ID ascending.
7. Cắt `topK`.

Rank dùng fixed constants trong file, không thêm config layer:

```text
exact criterion tag  +40
exact competency tag +30
category compatible  +20
normalized token overlap 0..15
verified             +10
unverified            +2
conflicting          -15
report_only          -25
```

Token overlap chỉ là normalized lexical overlap:

```text
intersection(criterion tokens, evidence tokens)
------------------------------------------------
max(1, criterion token count)
```

Không dùng embedding, cosine similarity, external API, package tokenizer hoặc vector column.

**Step 5: Thêm evidence reference validator**

```ts
export function validateEvidenceReferences(
  result: CriterionMatchResult,
  suppliedEvidence: MatchingEvidence[],
): CriterionMatchResult;
```

Validator phải:

- reject unknown ID;
- reject ID không có trong batch prompt;
- dedupe IDs;
- buộc direct/supporting IDs là subset của `evidenceIds`;
- downgrade `strong -> moderate` nếu không có direct evidence hợp lệ;
- downgrade `moderate -> weak` nếu không có evidence;
- với `missing`, xóa evidence claim khỏi supporting/direct và giữ `missingEvidence`;
- không “repair” bằng cách tạo ID mới.

**Step 6: Chạy tests và commit**

```powershell
npm test -- src/lib/ai/matching/evidence.test.ts src/shared/evidence/build-evidence-bank.test.ts
git add -- src/lib/ai/matching/evidence.ts src/lib/ai/matching/evidence.test.ts
git commit -m "feat: add deterministic matching evidence retrieval"
```

---

## Task 4: Hard requirements và deterministic aggregation

**Files:**

- Create: `src/lib/ai/matching/aggregation.ts`
- Create: `src/lib/ai/matching/aggregation.test.ts`
- Modify only if a proven adapter gap exists: `src/lib/ai/academic-analysis.ts`
- Modify only with regression tests: `src/lib/ai/academic-analysis.test.ts`
- Reuse: `src/shared/evaluation/f5-programme-fit.ts`

**Step 1: Viết failing hard-requirement adapter tests**

Implement target parsing only for formats deterministic analyzer can safely support:

- IELTS/TOEFL/SAT/ACT/GPA/IB/percentage numeric thresholds;
- explicit `>=`, `minimum`, `at least`, hoặc clear numeric requirement;
- unknown text/qualification/subject -> `insufficient_information`, không đoán;
- portfolio/required document: meets chỉ khi Evidence Bank có đúng document source; nếu không có thì `insufficient_information`, không mặc định `does_not_meet`.

**Step 2: Implement adapter dùng `assessAcademicRequirements()`**

```ts
export function evaluateHardRequirements(args: {
  criteria: MatchingCriterion[];
  academicProfile: AcademicProfile | null;
  evidenceBank: EvidenceBank;
}): HardRequirementMatch[];
```

Quy tắc:

- Numeric academic specs phải được chuyển sang `AcademicRequirementSpec[]` rồi gọi `assessAcademicRequirements()`.
- Mapping verdict giữ nguyên.
- `matchedRecordId` chỉ map sang evidence ID khi claim đó tồn tại trong Evidence Bank.
- LLM không tham gia task này.

**Step 3: Viết failing aggregation tests**

Coverage mapping:

```ts
const ALIGNMENT_VALUE = { strong: 1, moderate: 0.65, weak: 0.25, missing: 0 };
const IMPORTANCE_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1 };
```

Test:

- coverage weighted đúng và rounded `0..100`;
- scholarship criteria không ảnh hưởng programme coverage;
- missing critical criterion có weight lớn;
- hard failure không bị semantic score che;
- score deterministic ổn định khi reorder input;
- score chỉ là current alignment, không phải admission probability.

**Step 4: Implement aggregation helpers**

Export các pure function:

```ts
calculateEvidenceCoverage(criteria, signals): number;
deriveStrengths(criteria, signals): MatchingStrength[];
deriveGaps(criteria, hardRequirements, signals): MatchingGap[];
derivePositioningOpportunities(criteria, signals): PositioningOpportunity[];
buildDependencyIndex(signals): Record<string, string[]>;
```

Rules:

- Strength: alignment `strong`, importance ít nhất `medium`, evidenceQuality không `weak/none`, có evidence ID.
- Critical gap: hard requirement `does_not_meet`.
- High gap: high/critical + missing; high + weak là high/medium.
- `missing_evidence` khi capability chưa thể kết luận do thiếu proof.
- `capability_gap` chỉ khi evidence trực tiếp đủ rõ nhưng cho thấy mismatch; không suy từ silence.
- `positioning_gap` chỉ khi đã có relevant evidence nhưng criterion connection yếu.
- Gap priority deterministic: importance × alignment deficit × hard multiplier × fixability modifier.
- Positioning opportunity chỉ tham chiếu evidence có thật, không che hard gap.

**Step 5: Dùng F5 hiện có cho programme fit**

Không tạo fit classifier mới. Composer ở task sau phải gọi `assessProgrammeFit()` và parse qua `programmeFitSchema`; persisted `classification`, `confidence`, `limitations` lấy từ deterministic F5.

**Step 6: Chạy tests và commit**

```powershell
npm test -- src/lib/ai/matching/aggregation.test.ts src/lib/ai/academic-analysis.test.ts src/shared/evaluation/f5-programme-fit.test.ts
git add -- src/lib/ai/matching/aggregation.ts src/lib/ai/matching/aggregation.test.ts
git commit -m "feat: add deterministic matching aggregation"
```

---

## Task 5: Structured criterion reasoner và bắt buộc AI report summary

**Files:**

- Create: `src/lib/ai/matching/reasoner.ts`
- Create: `src/lib/ai/matching/reasoner.test.ts`
- Modify: `src/lib/ai/runtime/prompt-registry.ts`
- Modify: `src/lib/ai/runtime/structured-generation.test.ts` only if registry contract needs coverage
- Reuse: `src/lib/ai/runtime/structured-generation.ts`

**Step 1: Đăng ký hai prompt version**

Thêm đúng hai key vào registry hiện có:

```ts
matching_criterion_reasoning: 'matching-criterion-v2.0.0',
matching_report_summary: 'matching-summary-v2.0.0',
```

Không tạo prompt registry thứ hai.

**Step 2: Viết failing reasoner tests với injected generator**

Không gọi network trong test. Inject `generateStructured` fake và cover:

- prompt chỉ chứa criteria batch + retrieved evidence + minimal personal context;
- batch tối đa 6 criteria;
- evidence ID hallucination bị reject/downgrade;
- generic impressive evidence không tạo strong alignment;
- vague “I led many projects” không thành strong evidence;
- Personal Report context không xuất hiện trong evidence IDs;
- output `missing` khi không có relevant evidence;
- failure của một batch không xóa kết quả batch khác; orchestrator trả recoverable error để route giữ report cũ.
- summary generator nhận structured results, không nhận raw CV/essay/applicant state;
- summary generator được gọi đúng một lần cho mỗi report regeneration;
- summary output có `criterionIds` và `evidenceIds` hợp lệ;
- summary chứa ID lạ hoặc không có provenance bị reject;
- summary generation failure không cho persist report mới.

**Step 3: Implement reasoner**

```ts
export async function reasonAboutCriteria(args: {
  criteria: MatchingCriterion[];
  evidenceByCriterion: Record<string, MatchingEvidence[]>;
  personalContext: {
    coreIdentity: string[];
    motivations: string[];
    direction: string[];
  };
  generate?: typeof generateStructured;
}): Promise<FitSignal[]>;
```

Batch theo category/coherence, tối đa 6 criteria. Mỗi criterion chỉ nhận evidence đã retrieve riêng cho nó.

System rules bắt buộc:

```text
Use only supplied applicant evidence.
Evaluate the specific criterion only.
Do not reward unrelated prestige.
Distinguish direct evidence from supporting context.
Personal Report context can guide interpretation but is not raw evidence.
Weak or vague evidence cannot become strong alignment.
Missing evidence must be labelled missing.
Every applicant-specific claim must cite supplied evidence IDs.
Do not predict admission probability.
Do not invent programme criteria.
```

**Step 4: Implement AI summary generator trong cùng module**

Không tạo thêm summary service/class. Dùng cùng `generateStructured()` runtime:

```ts
export async function generateMatchingSummary(args: {
  academicRequirements: HardRequirementMatch[];
  programmeAlignment: FitSignal[];
  strengths: MatchingStrength[];
  gaps: MatchingGap[];
  positioningOpportunities: PositioningOpportunity[];
  scholarshipAlignment: MatchingReportV2['scholarshipAlignment'];
  programmeFit: ProgrammeFit;
  generate?: typeof generateStructured;
}): Promise<MatchingSummaryResult>;
```

Summary call chỉ nhận structured output đã hoàn tất. Không truyền raw Evidence Bank, CV, essay, full Personal Report hoặc full ApplicantAIState.

Summary output schema:

```ts
const matchingSummaryResultSchema = z.object({
  summary: z.string().trim().min(80).max(1600),
  criterionIds: z.array(z.string().min(1)).max(12),
  evidenceIds: z.array(z.string().min(1)).max(20),
}).strict();
```

Summary prompt rules bắt buộc:

```text
Summarize only the supplied structured matching results.
Do not add applicant facts, programme criteria or admission predictions.
State critical hard-requirement failures before general strengths.
Keep scholarship alignment separate from programme alignment.
Every applicant-specific conclusion must be grounded in supplied criterion IDs
and evidence IDs returned with the summary.
Do not turn missing evidence into a confirmed capability gap.
```

**Step 5: Validate AI outputs ở hai lớp**

1. Zod structured output parse.
2. `validateEvidenceReferences()` deterministic guardrail.

Summary validator phải đảm bảo:

- every `criterionId` tồn tại trong normalized criteria/result set;
- every `evidenceId` tồn tại trong validated FitSignals/strengths/gaps/opportunities;
- hard failure quan trọng không bị summary mô tả ngược;
- summary không chứa “admission chance”, “acceptance probability” hoặc “guaranteed admission”;
- summary không hợp lệ phải throw, không fallback sang AI text không kiểm chứng hoặc deterministic text.

Nếu model output invalid sau retry policy hiện có, throw typed/recoverable error; route không insert incomplete report.

**Step 6: Chạy tests và commit**

```powershell
npm test -- src/lib/ai/matching/reasoner.test.ts src/lib/ai/runtime/structured-generation.test.ts
git add -- src/lib/ai/matching/reasoner.ts src/lib/ai/matching/reasoner.test.ts src/lib/ai/runtime/prompt-registry.ts
git commit -m "feat: add grounded criterion matching reasoner"
```

---

## Task 6: Report composer và criterion-level incremental reuse

**Files:**

- Create: `src/lib/ai/matching/report.ts`
- Create: `src/lib/ai/matching/report.test.ts`
- Reuse: `stableHash()` từ `src/features/apply/api/candidate-context.ts`, đã export qua `src/features/apply/api/index.ts`
- Reuse: `src/shared/evaluation/f5-programme-fit.ts`

**Step 1: Viết failing report composition tests**

Cover:

- criteria được tách hard / semantic programme / scholarship;
- AI summary chỉ nhận/tóm tắt structured results, không thêm fact;
- summary generator được gọi đúng một lần trong mỗi `composeMatchingReport()` thành công;
- report không được trả về khi summary generator fail hoặc trả provenance ID lạ;
- `overall.summary`, `summaryCriterionIds`, `summaryEvidenceIds` lấy từ validated AI summary output;
- scholarship output không ảnh hưởng programme score;
- hard failure render trước strengths;
- every strength/gap/opportunity evidence ID tồn tại;
- report metadata chứa đủ lineage;
- same input tạo same criterion input hash;
- đổi một leadership claim chỉ recompute leadership-related criteria;
- đổi Target Profile source làm criteria liên quan stale;
- unchanged criterion reuse old `FitSignal` và xuất hiện trong `reusedCriterionIds`.

**Step 2: Implement per-criterion input identity**

```ts
criterionInputHash = stableHash({
  criterion,
  evidence: retrievedEvidence.map(pickStableEvidenceFields),
  personalContext: relevantMinimalContext,
  promptVersion,
  matchingEngineVersion,
});
```

Không hash generated timestamp hoặc UI state.

**Step 3: Implement incremental reuse**

```ts
export function partitionCriteriaForRecompute(args: {
  criteria: MatchingCriterion[];
  inputHashes: Record<string, string>;
  previousReport: MatchingReportV2 | null;
}): {
  reusableSignals: FitSignal[];
  criteriaToEvaluate: MatchingCriterion[];
};
```

Reuse chỉ khi:

- previous contract version đúng;
- criterion ID tồn tại;
- `inputHash` trùng;
- evidence refs trong signal vẫn tồn tại;
- engine/prompt version tương thích.

Hard requirements rẻ và deterministic: luôn recompute. Summary/strengths/gaps/coverage luôn compose lại từ signal mới + reused, không reuse mù aggregate cũ.

**Step 4: Implement report composer**

```ts
export async function composeMatchingReport(args: {
  targetProfile: TargetProfile;
  targetProfileVersionId: string;
  applicantState: ApplicantAIState;
  evidenceBank: EvidenceBank;
  personalReport: ApplicationPersonalReportV2Record;
  sourceAnalysisVersionId: string;
  confirmedSnapshotId: string;
  previousReport: MatchingReportV2 | null;
  reasoner?: typeof reasonAboutCriteria;
  summaryGenerator?: typeof generateMatchingSummary;
}): Promise<MatchingReportV2>;
```

Pipeline:

1. normalize criteria;
2. hard requirement evaluation;
3. deterministic retrieval cho semantic programme criteria;
4. calculate criterion hashes;
5. reuse unchanged signals;
6. reason changed signals;
7. validate all refs;
8. process scholarship criteria riêng cùng pipeline;
9. derive strengths/gaps/positioning/coverage;
10. call existing F5 deterministic engine;
11. gọi `generateMatchingSummary()` đúng một lần từ structured fields đã validate;
12. validate summary criterion/evidence provenance;
13. Zod parse full report.

AI summary là bước bắt buộc đối với report V2 mới. Không có deterministic fallback cho `overall.summary`: nếu call/schema/provenance validation thất bại, toàn bộ regeneration thất bại và previous complete report được giữ. Cache hit không đi qua composer nên không gọi summary model lại.

**Step 5: Chạy tests và commit**

```powershell
npm test -- src/lib/ai/matching/report.test.ts src/lib/ai/matching/*.test.ts
git add -- src/lib/ai/matching/report.ts src/lib/ai/matching/report.test.ts
git commit -m "feat: compose incremental matching report v2"
```

---

## Task 7: Additive database migration trên bảng hiện có

**Files:**

- Create: `supabase-matching-report-v2.sql`
- Reference: `supabase-apply-v2.sql`
- Reference: `supabase-ai-strategy-reports.sql`
- Reference: `supabase-matching-report-personal-lineage.sql`
- Reference: `supabase-application-personal-report-state.sql`

**Step 1: Viết migration additive**

```sql
ALTER TABLE public.application_match_analyses
  ADD COLUMN IF NOT EXISTS report_v2 JSONB,
  ADD COLUMN IF NOT EXISTS report_contract_version TEXT,
  ADD COLUMN IF NOT EXISTS matching_engine_version TEXT,
  ADD COLUMN IF NOT EXISTS target_profile_version_id UUID
    REFERENCES public.programme_target_profile_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_analysis_version_id UUID
    REFERENCES public.application_profile_analysis_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_snapshot_id UUID
    REFERENCES public.confirmed_candidate_snapshots(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_match_analysis_v2_identity
  ON public.application_match_analyses(
    application_id,
    prompt_version,
    matching_engine_version,
    input_hash
  )
  WHERE report_v2 IS NOT NULL
    AND matching_engine_version IS NOT NULL
    AND input_hash IS NOT NULL;
```

Giữ `input_hash` hiện có làm cache identity; không thêm `cache_key` trùng nghĩa.

**Step 2: Thêm comments, không thêm policy mới**

Table đã có RLS owner policies. Migration chỉ thêm columns/index/comments; không mở rộng quyền.

**Step 3: Verify idempotence**

Run theo quy trình local của repo:

```powershell
npm run check:migrations
```

Expected: migration parse/check PASS. Nếu môi trường cho phép apply local Supabase, chạy file hai lần; lần hai không lỗi.

**Step 4: Commit**

```powershell
git add -- supabase-matching-report-v2.sql
git commit -m "db: extend matching analyses for report v2"
```

---

## Task 8: Repository dual-read/dual-write và legacy fallback

**Files:**

- Modify: `src/features/apply/api/ai-reports-repository.ts`
- Create: `src/features/apply/api/ai-reports-repository.test.ts`
- Modify: `src/features/apply/api/index.ts`
- Modify: `src/features/apply/domain/ai-reports.ts`
- Modify: `src/features/apply/domain/ai-reports.test.ts`

**Step 1: Viết failing repository tests**

Cover:

- parse valid `report_v2` qua Zod;
- V2 row chỉ hợp lệ khi có AI summary provenance và `metadata.aiCallCount.summary === 1`;
- invalid `report_v2` không crash page, fallback legacy;
- legacy row vẫn map đúng current UI contract;
- V2 row expose both `reportV2` và existing F5 fields;
- queries filter ownership/application;
- insert payload chứa exact lineage;
- unique violation do concurrent same input đọc lại existing row thay vì fail user request.

**Step 2: Thêm repository record shape**

Mở rộng type hiện có, không tạo repository class:

```ts
type MatchingAnalysisRecord = ExistingFields & {
  reportV2: MatchingReportV2 | null;
  reportContractVersion: string | null;
  matchingEngineVersion: string | null;
  targetProfileVersionId: string | null;
  sourceAnalysisVersionId: string | null;
  confirmedSnapshotId: string | null;
};
```

**Step 3: Thêm scoped read helpers**

```ts
getLatestApplicationMatchingAnalysis(supabase, { userId, applicationId });
getMatchingAnalysisByInputHash(supabase, { userId, applicationId }, identity);
saveApplicationMatchingAnalysis(supabase, scope, payload);
```

Mọi helper phải filter `user_id` + `application_id`. Không fallback global row.

**Step 4: Dual-write payload**

Row V2 vẫn ghi:

- `current_match_score`, `max_possible_match_score`, labels;
- `pillars`, `strengths`, `weaknesses`, `improvement_actions`, `explanation`;
- `fit_dimensions`, `fit_eligibility`, `fit_classification`, `fit_confidence`, `fit_limitations`;
- existing personal report lineage + F5 engine version;
- V2 report + V2 lineage columns.

Legacy score/F5 projections lấy deterministic từ `reportV2`; legacy `explanation` lấy từ validated `reportV2.overall.summary`. Repository không gọi LLM lại.

**Step 5: Chạy tests và commit**

```powershell
npm test -- src/features/apply/api/ai-reports-repository.test.ts src/features/apply/domain/ai-reports.test.ts
git add -- src/features/apply/api/ai-reports-repository.ts src/features/apply/api/ai-reports-repository.test.ts src/features/apply/api/index.ts src/features/apply/domain/ai-reports.ts src/features/apply/domain/ai-reports.test.ts
git commit -m "feat: persist matching report v2 with legacy fallback"
```

---

## Task 9: Tích hợp orchestrator vào route hiện có

**Files:**

- Create: `src/lib/ai/matching/generation.ts`
- Create: `src/lib/ai/matching/generation.test.ts`
- Modify: `src/app/api/applications/[id]/match-insights/route.ts`
- Modify: `src/app/api/applications/[id]/match-insights/route.test.ts`
- Reuse: `src/features/apply/api/personal-report-generation.ts`
- Reuse: `src/features/apply/api/application-analysis-repository.ts`
- Reuse: `src/lib/ai/target-profile/generation.ts`

**Step 0: Đọc Next.js 16 route-handler guide trong repo**

Read:

```text
node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md
```

Giữ `context.params` là Promise, Node runtime và route dynamic behavior đúng phiên bản Next.js đang cài.

**Step 1: Viết generation orchestration tests**

Inject Supabase/repository/resolver/reasoner fakes để cover:

1. owned application only;
2. Personal Report complete trước Matching Report;
3. lấy đúng source analysis version từ Personal Report lineage, không lấy “latest” khác version;
4. Evidence Bank lấy từ đúng `application_profile_analysis_versions` row;
5. Target Profile cache hit được reuse;
6. target profile not ready trả typed result, không insert;
7. exact same input trả cached row;
8. partial evidence change chỉ reason changed criteria;
9. invalid criterion output không insert partial report;
10. mỗi regeneration gọi summary generator đúng một lần;
11. cache hit gọi `0` criterion AI call và `0` summary AI call;
12. semantic criteria được reuse toàn bộ nhưng hard/structured result đổi vẫn gọi summary AI đúng một lần;
13. summary AI failure/invalid provenance không insert và giữ previous report;
14. persistence failure giữ previous report.

**Step 2: Implement orchestrator function**

```ts
export async function generateApplicationMatchingReport(args: {
  supabase: SupabaseClient;
  userId: string;
  applicationId: string;
  force?: boolean;
}): Promise<
  | { status: 'cached'; record: MatchingAnalysisRecord }
  | { status: 'regenerated'; record: MatchingAnalysisRecord; reusedCriterionIds: string[] }
  | { status: 'not_ready'; reason: string }
  | { status: 'migration_missing' }
  | { status: 'not_configured' }
>;
```

Orchestration order:

```text
load owned application
  -> regenerate/reuse application Personal Report V2
  -> read exact source analysis version from Personal Report lineage
  -> validate EvidenceBank eb-v1
  -> read ApplicantAIState/AcademicProfile from exact structured outputs
  -> resolveTargetProfile(programme/course id)
  -> build full input_hash from lineage + engine/prompt versions
  -> return exact cache hit when present
  -> require configured AI runtime for every non-cached regeneration
  -> load previous V2 report for incremental criterion reuse
  -> compose report
  -> save dual-write row
```

Nếu `OPENAI_API_KEY`/model runtime không được cấu hình, trả `not_configured` trước composer và không insert row. Một non-cached V2 report không được phép “thành công” chỉ bằng deterministic fallback.

Canonical `input_hash` material:

```ts
stableHash({
  confirmedSnapshotId,
  sourceAnalysisVersionId,
  personalReportVersionId: personalRecord.id,
  personalReportInputHash: personalRecord.inputHash,
  targetProfileVersionId,
  targetProfileSchemaVersion: TARGET_PROFILE_SCHEMA_VERSION,
  evidenceBankVersion: evidenceBank.version,
  matchingEngineVersion: MATCHING_ENGINE_VERSION,
  f5EngineVersion: F5_ENGINE_VERSION,
  promptBundleVersion: MATCHING_PROMPT_BUNDLE_VERSION,
  criterionPromptVersion: REPORT_PROMPT_VERSIONS.matching_criterion_reasoning,
  summaryPromptVersion: REPORT_PROMPT_VERSIONS.matching_report_summary,
});
```

Persist column `prompt_version` bằng `MATCHING_PROMPT_BUNDLE_VERSION`; persist hai component prompt versions trong `report_v2.metadata`. Thay đổi bất kỳ prompt version nào phải làm `input_hash` đổi và buộc report regeneration.

**Step 3: Thu gọn route thành HTTP adapter**

Giữ tại route:

- auth;
- params Promise theo Next.js 16;
- entitlement/cooldown;
- HTTP status mapping;
- telemetry;
- response compatibility.

Chuyển generation/persistence logic sang orchestrator. Không đổi public route.

Response success có thể thêm fields additive:

```json
{
  "ok": true,
  "cached": false,
  "analysis": {},
  "reportV2": {},
  "reusedCriterionIds": []
}
```

Client cũ tiếp tục đọc `analysis`.

**Step 4: Giữ legacy analyzer có kiểm soát**

Không xóa `src/lib/ai/match-insights.ts`. Route V2 không cần gọi giant analyzer khi report composer đã đủ output. Legacy tests/module vẫn giữ cho rollback và historical rows. Cleanup là task riêng sau rollout.

**Step 5: Telemetry**

Log metadata, không log raw applicant text:

- report/application/target profile IDs;
- criteria/hard/semantic counts;
- LLM batch count;
- evidence count;
- reused criterion count;
- criterion AI batch count và summary AI call count (`1` với regenerated report, `0` với cache hit);
- validation failures/retries;
- latency/model/prompt/engine versions.

**Step 6: Chạy route + generation tests**

```powershell
npm test -- src/lib/ai/matching/generation.test.ts src/app/api/applications/[id]/match-insights/route.test.ts
```

Expected: PASS; legacy cache/cooldown/error response tests vẫn pass.

**Step 7: Commit**

```powershell
git add -- src/lib/ai/matching/generation.ts src/lib/ai/matching/generation.test.ts 'src/app/api/applications/[id]/match-insights/route.ts' 'src/app/api/applications/[id]/match-insights/route.test.ts'
git commit -m "feat: generate matching v2 through existing route"
```

---

## Task 10: Progressive UI enhancement, không thay redesign hiện có

**Files:**

- Modify: `src/features/apply/domain/matching-report-presentation.ts`
- Modify: `src/features/apply/domain/matching-report-presentation.test.ts`
- Modify carefully: `src/features/apply/ui/matching-report-view.tsx`
- Modify carefully as needed: `src/features/apply/ui/matching-report/requirement-status-track.tsx`
- Modify carefully as needed: `src/features/apply/ui/matching-report/gap-impact-ranking.tsx`
- Modify carefully as needed: `src/features/apply/ui/matching-report/strategic-summary-flow.tsx`
- Modify carefully as needed: `src/features/apply/ui/matching-report/evidence-flow-card.tsx`
- Modify: `src/features/apply/ui/matching-report-view.test.tsx`

**Step 1: Inspect user-owned UI diff trước khi sửa**

```powershell
git diff -- src/features/apply/ui/matching-report-view.tsx
Get-ChildItem src/features/apply/ui/matching-report -File
```

Không overwrite toàn file. Patch component/data adapter nhỏ nhất phù hợp với redesign hiện tại.

**Step 2: Viết presentation tests**

V2 sections theo thứ tự:

1. Current Alignment Snapshot.
2. Critical Requirements.
3. Strongest Alignment Areas.
4. Important Gaps.
5. Programme Criteria Breakdown.
6. Positioning Opportunities.
7. Scholarship Alignment, chỉ khi có criteria.
8. Evidence That Would Improve This Assessment.

Test:

- critical hard failure xuất hiện trước strengths;
- mỗi insight expose “why” + evidence refs;
- missing evidence hiển thị đúng, không thành “candidate lacks capability”;
- scholarship section tách riêng;
- legacy fallback giữ sáu section/report hiện tại;
- loading/error/cooldown states không regress;
- `nextRegenerationAt` và legacy `nextAvailableAt` fallback đều render.

**Step 3: Implement presentation adapter**

`matching-report-presentation.ts` nhận `reportV2 | null`:

- nếu V2: map contract mới vào view model;
- nếu null/invalid: chạy mapping legacy hiện tại;
- không để React component tự hiểu Supabase snake_case/raw JSON.

**Step 4: Wire components hiện có**

Ưu tiên reuse:

- `requirement-status-track.tsx` cho hard requirements;
- `gap-impact-ranking.tsx` cho prioritized gaps;
- `evidence-flow-card.tsx` cho criterion → evidence provenance;
- `strategic-summary-flow.tsx` cho strengths/gaps/positioning;
- giữ `score-gauge-trio.tsx`, `fit-profile-chart.tsx`, `admissions-perspective-canvas.tsx` nếu chúng đang phục vụ F5/legacy data.

Không thêm visualization/component mới nếu component hiện có cover được.

**Step 5: Accessibility minimum**

- headings theo hierarchy;
- status không chỉ biểu diễn bằng màu;
- evidence disclosure dùng button thật với accessible name;
- loading/status có `aria-live` phù hợp;
- keyboard focus không bị mất khi refresh report.

**Step 6: Chạy UI tests và commit**

```powershell
npm test -- src/features/apply/domain/matching-report-presentation.test.ts src/features/apply/ui/matching-report-view.test.tsx
git add -- src/features/apply/domain/matching-report-presentation.ts src/features/apply/domain/matching-report-presentation.test.ts src/features/apply/ui/matching-report-view.tsx src/features/apply/ui/matching-report-view.test.tsx src/features/apply/ui/matching-report
git commit -m "feat: present criterion-level matching report"
```

Trước commit, kiểm tra staged diff để chắc chắn không kéo user file khác:

```powershell
git diff --cached --stat
git diff --cached
```

---

## Task 11: Bảo toàn Strategy và Improvement Tasks consumers

**Files:**

- Modify only if needed: `src/app/api/applications/[id]/strategy/recommendation/route.ts`
- Modify: `src/app/api/applications/[id]/strategy/recommendation/route.test.ts`
- Modify only if needed: `src/app/api/applications/[id]/strategy/course-match/route.ts`
- Modify only if needed: `src/app/api/applications/[id]/improvement-tasks/route.ts`
- Add tests beside routes only where V2 row shape exposes regression

**Step 1: Viết/extend compatibility tests trước**

Test cả hai fixture:

- legacy `application_match_analyses` row;
- V2 dual-written row.

Expected: Strategy recommendation và improvement tasks đọc cùng canonical F5 fields, không phụ thuộc `report_v2` để chạy.

**Step 2: Chỉ sửa nếu test fail**

Ưu tiên repository/domain adapter. Không cho mỗi route tự parse `report_v2`. V2 gaps có thể được dùng additive sau này, nhưng scope hiện tại phải giữ behavior consumer cũ.

**Step 3: Chạy tests**

```powershell
npm test -- src/app/api/applications/[id]/strategy/recommendation/route.test.ts src/app/api/applications/[id]/match-insights/route.test.ts
```

Expected: PASS với legacy và V2 fixture.

**Step 4: Commit nếu có diff**

```powershell
git add -- 'src/app/api/applications/[id]/strategy/recommendation/route.ts' 'src/app/api/applications/[id]/strategy/recommendation/route.test.ts' 'src/app/api/applications/[id]/strategy/course-match/route.ts' 'src/app/api/applications/[id]/improvement-tasks/route.ts'
git commit -m "test: keep matching consumers backward compatible"
```

Nếu không cần sửa production code, commit test-only là đúng kết quả.

---

## Task 12: Evaluation fixtures, full verification và docs handoff

**Files:**

- Create: `src/lib/ai/matching/evaluation.test.ts`
- Modify: `docs/current-status.md`
- Modify if commands/status changed: `docs/verification.md`
- Keep this plan updated only if implementation intentionally deviates: `docs/plans/2026-08-26-glowbal-matching-engine-implementation.md`

**Step 1: Tạo evaluation fixtures nhỏ, không build framework**

Dùng Vitest fixtures inline hoặc một fixture file duy nhất nếu data dài. Cover sáu case:

| Case | Expected |
|---|---|
| Strong match | several strong criteria, few important gaps, high coverage |
| Impressive but irrelevant | prestige không inflate fit |
| Vague evidence | leadership không tự thành strong; evidence quality weak |
| Missing mandatory requirement | critical eligibility issue đứng đầu |
| Strong evidence, poor positioning | positioning gap, không capability gap |
| Insufficient profile | nhiều missing, low coverage, không invented strength |

**Step 2: Thêm invariants regression**

- no invented applicant fact;
- no invented programme criterion;
- strong alignment always has valid direct evidence;
- Personal Report labels not raw evidence;
- evidence IDs always resolve;
- target source refs preserved;
- every regenerated V2 report performs exactly one AI summary call;
- persisted AI summary provenance IDs always resolve;
- summary AI failure never persists a partial/new row;
- cache hit performs no new AI call and returns the previously persisted AI summary;
- scholarship separate;
- score stability for same input;
- incremental output equals full recompute output;
- no wording implying admission probability.

**Step 3: Chạy focused suite**

```powershell
npm test -- src/lib/ai/matching src/shared/evidence src/shared/evaluation/f5-programme-fit.test.ts src/lib/ai/academic-analysis.test.ts src/features/apply/api/ai-reports-repository.test.ts src/app/api/applications/[id]/match-insights/route.test.ts src/features/apply/domain/matching-report-presentation.test.ts src/features/apply/ui/matching-report-view.test.tsx src/app/api/applications/[id]/strategy/recommendation/route.test.ts
```

Expected: PASS.

**Step 4: Chạy project verification**

Đọc `docs/verification.md`, sau đó tối thiểu:

```powershell
npm run lint
npm run typecheck
npm test
npm run build:ci
```

Expected: tất cả PASS. Ghi chính xác command/result; không claim check chưa chạy.

**Step 5: GitNexus/CodeGraph change impact trước commit cuối**

```powershell
codegraph explore "changed matching v2 files impact on match-insights Strategy Improvement Tasks MatchingReportView"
git diff --check
git status --short
```

Nếu GitNexus MCP/CLI index đang dùng trong session, chạy change detection tương ứng. Risk HIGH/CRITICAL phải được xử lý hoặc ghi rõ trước merge.

**Step 6: Update docs**

`docs/current-status.md` ghi ngắn gọn:

- V2 contract/engine versions;
- migration cần apply;
- route và UI compatibility;
- checks đã chạy và kết quả thật;
- known limitation: lexical deterministic retrieval, chưa embedding và không có kế hoạch thêm cho đến khi evaluation chứng minh cần.

**Step 7: Commit**

```powershell
git add -- src/lib/ai/matching/evaluation.test.ts docs/current-status.md docs/verification.md docs/plans/2026-08-26-glowbal-matching-engine-implementation.md
git commit -m "test: verify grounded matching report v2"
```

Chỉ add `docs/verification.md` nếu thật sự có diff thuộc task.

---

## 2. Rollout order

### Phase A — Merge-safe foundation

Tasks 1–6. Chưa cần bật route production. Kết quả là pure domain/reasoning/report modules có test đầy đủ.

### Phase B — Persistence và route

Tasks 7–9. Apply migration ở staging trước. Route chỉ ghi V2 sau khi columns tồn tại; môi trường thiếu migration trả `503` theo convention hiện có.

### Phase C — UI và consumers

Tasks 10–11. UI dual-read. Strategy/Planner tiếp tục dùng F5 legacy-compatible projection.

### Phase D — Evaluation và release

Task 12. So sánh một real programme fixture + một synthetic applicant fixture trước khi rollout rộng.

Không xóa legacy analyzer/columns ở bất kỳ phase nào trong plan này.

---

## 3. Acceptance checklist

- [ ] Target Profile criteria normalized với stable ID và provenance.
- [ ] Không invent missing criteria.
- [ ] Evidence retrieval deterministic, selective, không embedding.
- [ ] Hard academic requirements dùng `assessAcademicRequirements()`.
- [ ] Structured LLM đánh giá semantic criteria theo batch nhỏ; hard requirements vẫn deterministic.
- [ ] Mỗi regenerated V2 report gọi AI summary đúng một lần sau structured criterion analysis.
- [ ] AI summary chỉ dùng structured results và có valid criterion/evidence provenance.
- [ ] AI summary failure không persist report mới; previous complete report được giữ.
- [ ] Cache hit không gọi AI lại và trả persisted AI summary.
- [ ] Hallucinated evidence IDs bị reject/downgrade.
- [ ] Alignment tách khỏi evidence quality và confidence.
- [ ] Strengths/gaps/positioning đều evidence-backed.
- [ ] Scholarship matching tách khỏi programme matching/score.
- [ ] Coverage và fit score deterministic; không mô tả như admission chance.
- [ ] Exact Personal Report / analysis / snapshot / target profile lineage persisted.
- [ ] Same full input trả cache hit.
- [ ] Changed criterion input chỉ recompute criterion liên quan.
- [ ] Incremental result bằng full recompute result.
- [ ] Row mới dual-write F5/legacy fields.
- [ ] Legacy row vẫn render và vẫn dùng được ở Strategy/Improvement Tasks.
- [ ] UI redesign hiện có được giữ, chỉ nhận thêm V2 view model.
- [ ] Migration additive, idempotent, không đổi RLS.
- [ ] Generation failure không làm mất previous complete report.
- [ ] Focused tests, lint, typecheck, full tests và CI build pass.

---

## 4. Stop conditions cho agent triển khai

Dừng và báo lại, không tự mở rộng scope, nếu gặp một trong các trường hợp:

1. Target Profile đang dùng cho application không thể map chắc chắn từ `course_applications` sang `courses.id`.
2. Personal Report record thiếu application lineage dù migration đã apply.
3. Evidence Bank từ exact source analysis không parse được `eb-v1`.
4. Migration hiện tại ở environment khác với schema trong repo.
5. UI worktree có conflict trực tiếp với cùng lines/components đang triển khai.
6. Consumer downstream phụ thuộc undocumented field mà dual-write không cover.
7. Muốn thêm embedding/vector DB/package mới: đây là thay đổi kiến trúc, cần approval riêng và evaluation evidence trước.

---

## 5. Kết quả cuối agent phải handoff

Agent hoàn thành phải báo:

1. commit list theo từng task;
2. migration nào cần apply và thứ tự apply;
3. contract/engine/prompt versions thực tế;
4. focused/full verification commands và kết quả;
5. legacy fallback đã test bằng fixture nào;
6. tiêu chí nào được incremental reuse trong test;
7. mọi deviation so với plan và lý do;
8. mọi user-owned file đã chạm vào, kèm xác nhận không overwrite thay đổi có sẵn.
