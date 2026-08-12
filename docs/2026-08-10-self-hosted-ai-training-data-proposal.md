# Deep Data Requirement Audit for Current AI Pipeline

- Ngày: 2026-08-10
- Trạng thái: Data proposal dựa trên kiến trúc hiện trạng
- Nguồn chính: [current-ai-pipeline-architecture.md](../tmp/current-ai-pipeline-architecture.md)

Tài liệu này chỉ ước lượng dữ liệu cho bảy model contract đang tồn tại:

1. LOR review.
2. Strategy CV review.
3. Builder/streamed CV review.
4. Generic Essay review.
5. VinUni AACC Essay review V2.
6. Applicant Narrative.
7. Course Match dependency.

Reflection extraction, Personal Report và AI Coach không nằm trong architecture document được audit, vì vậy không được cộng vào các ước lượng SFT của tài liệu này.

Các con số là range hoạch định, không phải count hiện có trong Supabase. Chúng giả định:

- Fine-tune một model nền có sẵn, không pre-train foundation model từ đầu.
- Dữ liệu tiếng Việt là output chính; tài liệu đầu vào có cả tiếng Việt và tiếng Anh.
- Một applicant có thể có nhiều document và nhiều application.
- Một source document có thể tạo nhiều SFT records nhưng chỉ được tính là một document.
- Các output phức tạp được human review theo rubric trước khi trở thành Gold.

## 1. Executive conclusion

Kiến trúc hiện tại không cần một dataset admission chung. Nó cần bốn hệ dữ liệu tách biệt:

| Dataset | Vai trò | Có fine-tune vào model? |
| --- | --- | --- |
| Runtime knowledge | Programme, university, requirements, tuition, scholarship, intake, deadlines, official sources | Không |
| Training/SFT | Input-output pairs riêng cho từng model contract | Có |
| Evaluation | Held-out cases, hard negatives, temporal/OOD, repeatability | Không |
| Deterministic data | Rubric weights, IDs, score aggregation, eligibility rules, hashes, versions, date comparisons | Không |

Kết luận định lượng:

- Thí nghiệm đầu tiên có thể bắt đầu với 500–1.000 applicants, 8.000–15.000 SFT records trên bảy contracts và 3.000–5.000 Gold records.
- MVP dùng cho limited rollout cần khoảng 3.000–6.000 applicants, 40.000–80.000 SFT records, trong đó 14.000–28.000 Gold hoặc Organic đã human review.
- Production rộng cần khoảng 15.000–30.000 applicants và 150.000–300.000 SFT records, nhưng coverage và leakage control quan trọng hơn tổng record.
- Course Match là contract tốn dữ liệu nhất vì phụ thuộc đồng thời applicant, CV, essay, programme facts, requirements, finance, eligibility và missing-data behavior.
- VinUni V2 và streamed CV cần tính theo bundle: một essay/CV có thể tạo 2–3 pass-level SFT records.
- Deadline data là P0 runtime knowledge. Nó không phải kiến thức cần model học.
- MVP programme knowledge nên bắt đầu ở 1.000–3.000 programmes, 1.500–5.000 programme-intakes và khoảng 10.000–50.000 timeline events.
- Existing GPT outputs chỉ là Silver cho đến khi được human review; deterministic validation không chứng minh nội dung đúng hoặc hữu ích.
- Tối thiểu 35–45% training records của MVP nên có human review. LOR, VinUni và Course Match nên đạt 50–60%; toàn bộ evaluation set phải được review.

Hai CV contracts có thể dùng chung source CV nhưng không dùng chung target labels. Generic Essay và VinUni có thể dùng chung source essay nhưng không dùng chung rubric hoặc output labels. Các contract có thể dùng chung base model và tokenizer, nhưng cần task identifier, schema riêng, sampling riêng và evaluation suite riêng.

## 2. Current architecture data map

### 2.1 Data classification

| Class | Nghĩa trong architecture |
| --- | --- |
| USER_GENERATED | Text hoặc lựa chọn do user nhập trực tiếp |
| PROGRAMME_DATA | Programme, course, degree, subject, requirements, objectives, sources |
| UNIVERSITY_DATA | University identity, positioning và institution-level facts |
| PROFILE_DATA | Academic/profile goals, nationality, interests, skills, answers |
| DOCUMENT_DATA | LOR, CV, essay, extracted text, structured document |
| EVIDENCE_DATA | Activities, achievements, exact quotes, evidence IDs/spans |
| RUBRIC_DATA | Dimensions, AACC pillars, criteria, weights, allowed enums |
| TEMPORAL_DATA | Intake, deadline, academic cycle, versions and effective time |
| FINANCIAL_DATA | Tuition, budget, funding, scholarships, living costs |
| SYSTEM_METADATA | IDs, feature flags, tier, request mode, model/prompt/schema version |
| DERIVED_DATA | Segment IDs, target profile, input coverage, normalized facts |
| MODEL_GENERATED | Narrative, critique, gaps, recommendations, model scores |
| HUMAN_LABEL | Expert correction, acceptance, preference, evidence verification |

### 2.2 End-to-end contract flow

| Contract | Input → context | Model responsibility | Deterministic responsibility | Output | Storage | Feedback/label opportunity |
| --- | --- | --- | --- | --- | --- | --- |
| LOR review | LOR + application → programme + recommender strategy + selected evidence | Chấm 9 dimensions, summary, strengths, improvements, coverage, suggestions | Auth/quota, Zod, dimension uniqueness/range, quote substring verification, 85→100 score, label mapping | LorReview JSON | personal_statements.ai_analysis khi frontend save | Recommender/adviser correction; suggestion acceptance; quote validity |
| Strategy CV review | Structured CV + application + target profile | Strengths có evidence, missing signals, actions, summary, source URLs | Ownership, required target profile, result coercion, source URL allowlist, append/version/staleness | JSON strengths/missing signals | Append-only CV review rows | Consultant edits; action completion; review freshness |
| Builder CV review | PDF/DOCX/text → extraction → Cxxx segmentation + programme target | Hai streamed groups: criteria/summary và dynamic sections/recommendations | File limits, extraction, Cxxx IDs, NDJSON schemas, ID validity, missing-key repair, stream ordering, overall score | Ordered NDJSON + complete analysis | Client state; route không persist | User retry, section correction, accepted recommendation; hiện chưa được lưu đầy đủ |
| Generic Essay review | Essay + doc type + target university; Plus có CV/profile context | Overall score, summary, inline suggestions, checklist | Auth/tier/quota, length, JSON/Zod; hiện chưa verify originalText substring | JSON review | personal_statements.ai_analysis | Accept/reject replacement, edited text, expert review; provenance còn yếu |
| VinUni AACC V2 | Essay + prompt + VinUni/programme/profile/rubric → Uxxx segmentation | Coverage-map pass; A/B/C/E review; D pillar review | ID namespaces, evidence validation, section schemas, repair/fallback, AACC weights, F score, hash/version | NDJSON evidence map + A–F + complete | Frontend lưu complete analysis | Section-level expert correction, evidence mapping, fallback rate |
| Applicant Narrative | Profile + PS answers + achievements/activities | F1/F4 narrative: identity, strengths, growth, themes, positioning, rating | Input presence, storage/version, later F2/F3/F5/F6 evaluation engine | Narrative JSON | applicant_analyses | Adviser correction, theme confirmation/rejection, longitudinal edits |
| Course Match dependency | Programme/university + profile/tests/evidence + CV/essay + budget/career | Five pillars, evidence, gaps, improvements, programme-fit dimensions | Input hash/cache, normalization, weighted score, max constraints, confidence fallback, classification enforcement | Match insights + programme fit JSON | application_match_analyses | Adviser comparison, source verification, action completion; admission outcome không phải document-quality label |

### 2.3 Explicit input inventory from the current architecture

Không có field mới trong bảng sau; đây là các field/group đã xuất hiện trong architecture hoặc referenced runtime contracts.

| Contract | Field/group hiện có | Class | Consumer |
| --- | --- | --- | --- |
| LOR | LOR text | DOCUMENT_DATA, USER_GENERATED | Model + substring validator |
| LOR | applicationId | SYSTEM_METADATA | Ownership/context loader |
| LOR | university, programme, level, subject | UNIVERSITY_DATA, PROGRAMME_DATA | Model context |
| LOR | entry requirements, official sources | PROGRAMME_DATA | Model grounding |
| LOR | recommender type, relationship, duration | PROFILE_DATA, USER_GENERATED | Credibility/context dimensions |
| LOR | perspective, prioritized traits, do-not-prioritize, brief | USER_GENERATED, DERIVED_DATA | Model strategy context |
| LOR | selected activities/achievements observable by recommender | EVIDENCE_DATA | Model grounding |
| Strategy CV | structured CV | DOCUMENT_DATA | Model |
| Strategy CV | career direction | PROFILE_DATA | Target profile |
| Strategy CV | university positioning, education philosophy, environment | UNIVERSITY_DATA, DERIVED_DATA | Target profile/model |
| Strategy CV | programme objectives | PROGRAMME_DATA, DERIVED_DATA | Target profile/model |
| Strategy CV | priority capabilities, career alignment | DERIVED_DATA | Gap analysis |
| Strategy CV | content_version, target_profile_version | TEMPORAL_DATA, SYSTEM_METADATA | Persistence/staleness |
| Stream CV | PDF/DOCX/text, file size, extracted text | DOCUMENT_DATA | Extractor/model |
| Stream CV | basic programme target | PROGRAMME_DATA | Model context |
| Stream CV | Cxxx line IDs, expected dynamic sections | DERIVED_DATA | Model references + validator |
| Generic Essay | essay text | DOCUMENT_DATA, USER_GENERATED | Model |
| Generic Essay | document type | SYSTEM_METADATA | Prompt selection |
| Generic Essay | target university | UNIVERSITY_DATA | Model context |
| Generic Essay | Plus CV summary | DOCUMENT_DATA, DERIVED_DATA | Personalization |
| Generic Essay | profile summary, bio, achievements, skills, goals, grades, career interests | PROFILE_DATA, EVIDENCE_DATA | Personalization |
| Generic Essay | tier/quota | SYSTEM_METADATA | Backend only |
| VinUni | essay and essay prompt | DOCUMENT_DATA, USER_GENERATED, RUBRIC_DATA | Coverage + review passes |
| VinUni | VinUni profile | UNIVERSITY_DATA | Model context |
| VinUni | matched programme context | PROGRAMME_DATA | Model context |
| VinUni | optional student profile evidence | PROFILE_DATA, EVIDENCE_DATA | Model grounding |
| VinUni | AACC rubric and requested sections | RUBRIC_DATA, SYSTEM_METADATA | Model + validators |
| VinUni | Uxxx/profile/programme evidence IDs | DERIVED_DATA | References + validator |
| Applicant Narrative | nationality, qualification, school, year, subjects, predicted grades | PROFILE_DATA | Model |
| Applicant Narrative | career goals, learning style, interests | PROFILE_DATA, USER_GENERATED | Model |
| Applicant Narrative | personal-statement answers | PROFILE_DATA, USER_GENERATED | Model |
| Applicant Narrative | achievements and activities | EVIDENCE_DATA | Model |
| Course Match | course, university, subject, level, requirements, summary, country, duration, study mode | PROGRAMME_DATA, UNIVERSITY_DATA | Model |
| Course Match | intake, deadline | TEMPORAL_DATA | Model context + deterministic eligibility target |
| Course Match | tuition, scholarships | FINANCIAL_DATA | Financial-fit dimension |
| Course Match | university insight, requirements, career outcomes, official URL | UNIVERSITY_DATA, PROGRAMME_DATA | Grounding |
| Course Match | academics, grades, tests | PROFILE_DATA, EVIDENCE_DATA | Academic pillar |
| Course Match | activities, achievements, structured evidence | EVIDENCE_DATA | Activities/impact pillars |
| Course Match | CV and essay text | DOCUMENT_DATA | Essays/impact/personal pillars |
| Course Match | personal context, budget/funding, career direction | PROFILE_DATA, FINANCIAL_DATA | Fit dimensions |

### 2.4 Current storage and provenance

| Contract | Current provenance quality | Missing for training export |
| --- | --- | --- |
| LOR | Low–medium | Review-level model/prompt/schema version, input hash, explicit strategy snapshot, reviewer feedback |
| Strategy CV | High | Human label state and accepted/rejected missing signals |
| Stream CV | Low | Persisted final report, pass/bundle ID, repair history, accepted output |
| Generic Essay | Low | Model/prompt/rubric version, exact input snapshot/hash, replacement substring validation |
| VinUni V2 | High | Human review state and pass-level teacher lineage |
| Applicant Narrative | Medium–high | Source evidence refs and human correction history |
| Course Match | High technically | Fact-level provenance in model input, human calibration labels, separation of assessment from outcome |

## 3. Missing data map

| Missing/weak category | Current state | Why it matters | Contracts | Priority |
| --- | --- | --- | --- | --- |
| Normalized programme-intake timeline | Một deadline tổng quát, intake text và các task deadlines rời rạc | Eligibility/readiness và planning cần đúng cycle/round/timezone | Course Match; product runtime | P0 |
| Programme-level deadline events | University deadline text không đủ để đại diện programme/round | Cùng university có nhiều deadline theo programme, applicant type và intake | Course Match; runtime | P0 |
| Official fact lineage per prompt field | Catalogue V2 có fact/source pattern nhưng model contexts vẫn ghép text | Không thể biết claim dùng source nào hoặc source đã stale | LOR, Strategy CV, VinUni, Course Match | P0 |
| Human feedback state | Output thường được save nhưng accepted/edited/rejected không đồng nhất | Không phân biệt output được user chịu đựng với output đúng | Cả 7 | P0 |
| Applicant bundle identity | Các document nằm ở nhiều bảng | Split random gây leakage giữa CV, essay, LOR, profile | Cả 7 | P0 |
| De-identification and consent lineage | Chưa có training-export contract | Không thể dùng data an toàn hoặc audit quyền sử dụng | Cả 7 | P0 |
| Rubric/version lineage đồng nhất | VinUni/CV Strategy tốt; LOR/Generic Essay yếu | Không biết label thuộc rubric/prompt nào | Cả 7 | P0 |
| Cross-document contradiction labels | Model đọc nhiều document nhưng không có contradiction ground truth | Course Match/Narrative dễ tổng hợp claim mâu thuẫn | Applicant Narrative, Course Match | P1 |
| Programme requirement normalization | Nhiều requirement là free text | Eligibility không nên giao cho model đoán từ prose | Course Match, LOR, VinUni | P1 |
| Document quality metadata | Readability có ở extraction flow nhưng không thành dataset dimension chuẩn | Model/evaluation phải xử lý scan, partial, malformed | Stream CV, essays, LOR | P1 |
| Language/style metadata | Không có contract thống nhất cho language, translation, native/non-native style | Dễ overfit một kiểu tiếng Anh hoặc tiếng Việt | Cả 7 | P1 |
| Organic edit lineage | Không lưu diff từ AI suggestion tới user final text một cách nhất quán | Đây là preference/correction signal giá trị nhất | Generic Essay, CV, LOR | P1 |
| Recommender-role coverage | Có recommender strategy nhưng chưa có coverage inventory | LOR labels lệch nếu chỉ có teacher letters | LOR | P1 |
| Decision/outcome history | Application status có nhưng thiếu resolved outcome snapshot/conditions/timestamps đầy đủ | Chỉ cần nếu nghiên cứu outcome; không phải ground truth review quality | Course Match research | P3 |
| Admissions expert disagreement | Chưa lưu multiple ratings/adjudication | Absolute scores có thể không ổn định giữa experts | LOR, Essay, VinUni, Match | P2 |

Outcome labels không phải P0/P1 cho bảy contracts hiện tại. Một hồ sơ bị reject có thể vẫn là CV/essay tốt do quota, competition, visa, portfolio, recommendation hoặc factors không được quan sát. Không dùng offer/reject làm ground truth trực tiếp cho document review.

## 4. Runtime knowledge requirements

### 4.1 Runtime data that should not be SFT knowledge

- University identity and official source domains.
- Programme availability, objectives, curriculum and delivery mode.
- Entry, English, subject and document requirements.
- Programme-intake and application-round data.
- Tuition, deposits, scholarships and financial-aid facts.
- Deadline and timeline events.
- Eligibility constraints.
- Official URLs, evidence snippets, source scopes and freshness.
- Product route/action mappings.

Model có thể học cách sử dụng các facts này, nhưng không nên ghi nhớ giá trị cụ thể. Input runtime phải cung cấp snapshot đúng cycle.

### 4.2 Required runtime entities

| Entity | Essential fields | Primary consumers |
| --- | --- | --- |
| University | ID, canonical name, country, official domains, verification status | Tất cả programme-dependent contracts |
| Programme | ID, university ID, name, degree, subject, objectives, official URL, status | LOR, CV Strategy, VinUni, Course Match |
| Programme offering/intake | Programme ID, academic cycle, intake, campus/mode, availability | Course Match and planning |
| Requirement fact | Offering/programme ID, requirement type, normalized value, raw text, evidence/source | Course Match; target profile |
| Source fact | Field, value, source URL/type, quote/locator, retrieved/verified time, confidence | Grounding and audit |
| Timeline event | Offering/intake, round, event type, timestamps, timezone, source/provenance | Eligibility/readiness/planner |
| Tuition/fee | Offering/intake, currency, amount/range, fee type, period, source/effective dates | Course Match |
| Scholarship | University/programme scope, eligibility, value, deadline, source, status | Course Match |
| Rubric | Contract, version, dimensions, scoring ranges, examples, effective dates | Training and runtime validation |

### 4.3 Runtime knowledge scale

Assumptions: trung bình 1,5–1,8 offerings/intakes đang hoạt động cho mỗi programme; 4–8 requirement facts và 6–10 timeline events cho mỗi programme-intake.

| Scale | Universities | Programmes | Programme-intakes | Requirement facts | Timeline events | Scholarships |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| MVP | 100–250 | 1.000–3.000 | 1.500–5.000 | 8.000–30.000 | 10.000–50.000 | 1.000–5.000 |
| Production-small | 500–1.000 | 5.000–12.000 | 8.000–20.000 | 40.000–120.000 | 50.000–180.000 | 5.000–20.000 |
| Production-medium | 1.000–2.500 | 20.000–50.000 | 35.000–90.000 | 150.000–500.000 | 250.000–900.000 | 20.000–80.000 |
| Large-scale | 3.000–6.000 | 80.000–150.000 | 140.000–270.000 | 600.000–1.500.000 | 1.000.000–2.700.000 | 80.000–250.000 |

Các range này là record counts, không phải training samples. Một source refresh tạo version mới nhưng không nhất thiết tạo SFT record.

## 5. Deadline and temporal-data design

### 5.1 Current deadline coverage

Current schema/code có:

- course_applications.deadline, deadline_source và deadline_confidence.
- universities.application_deadline dạng text.
- scholarships.deadline_date, deadline_text và source_url.
- courses/course_applications intake.
- course_offerings academic_cycle, intake và application_status.
- profile target_intake và application_cycle_year.
- application tasks có deadline; task templates có relative_deadline_days.

Đó chưa phải normalized official timeline.

| Event requested | Current coverage | Assessment |
| --- | --- | --- |
| Application opening date | Không thấy normalized field | Missing |
| Application deadline | Có một date/text tổng quát | Weak; thiếu programme/intake/round/timezone |
| Early decision/action | Không thấy | Missing |
| Priority deadline | Không thấy | Missing |
| Rolling admission | Có thể nằm trong prose/status, không normalized | Missing/weak |
| Scholarship deadline | Có date/text ở scholarship | Partial; thiếu programme-intake linkage/effective period |
| Financial-aid deadline | Không thấy | Missing |
| Recommendation-letter deadline | Không thấy official event | Missing |
| Transcript deadline | Không thấy official event | Missing |
| English-test deadline | Không thấy | Missing |
| Standardized-test deadline | Không thấy | Missing |
| Portfolio deadline | Không thấy | Missing |
| Interview period | Có VinUni display content, không normalized general schema | Missing |
| Decision-release date | Không thấy | Missing |
| Offer acceptance deadline | Task template tương đối, không official event | Missing |
| Deposit deadline | Không thấy | Missing |
| Visa milestone | Không thấy | Missing |
| Enrolment deadline | Không thấy | Missing |

### 5.2 Deadline handling decision

Deadline values phải:

1. Được retrieve từ official sources hoặc authoritative application portals.
2. Lưu vào database theo programme-intake-round.
3. Cache ở runtime.
4. Refresh định kỳ theo mức rủi ro.
5. Manual verify khi confidence thấp, source conflict hoặc deadline gần.
6. So sánh với current time bằng code, không bằng model.

SFT chỉ cần examples dạy model cách nói “unknown”, giải thích limitation hoặc trích deadline từ context. Không dùng deadline value như kiến thức cần ghi vào model weights.

### 5.3 Proposed timeline schema

| Field | Essential? | Purpose/consumer |
| --- | --- | --- |
| id | Yes | Stable event identity |
| university_id | Yes | Institution scope |
| programme_id | Nullable | Null chỉ khi event thực sự áp dụng toàn university |
| programme_offering_id | Preferred | Liên kết chính xác programme-intake/campus/mode |
| intake | Yes | Human-readable intake |
| academic_year | Yes | Cycle disambiguation |
| application_round | Yes | regular, early_action, early_decision, priority, rolling, scholarship, other |
| applicant_scope | Yes | international/domestic/all hoặc normalized eligibility scope |
| event_type | Yes | open, application_deadline, scholarship_deadline, transcript, test, portfolio, interview_start/end, decision_release, offer_acceptance, deposit, visa, enrolment |
| opens_at | Nullable | Application/event window opening |
| deadline_at | Nullable | Exact timestamp when known |
| window_start_at/window_end_at | Nullable | Period events such as interviews |
| timezone | Yes when time exists | Prevent off-by-one-day/hour |
| date_precision | Yes | exact_time, date_only, month_only, approximate |
| is_rolling | Yes | Rolling behavior |
| priority | Yes | primary, secondary, informational |
| source_url/source_type | Yes | Provenance |
| evidence_quote/evidence_locator | Preferred | Verifiable extraction |
| retrieved_at | Yes | Freshness |
| verified_at/verified_by | Nullable | Manual/automated verification |
| valid_from/valid_until | Yes | Effective lifecycle |
| confidence | Yes | 0–1 or controlled enum |
| verification_status | Yes | unverified, verified, conflicted, stale, superseded |
| content_hash | Yes | Change detection |
| supersedes_event_id | Nullable | Version chain |
| created_at/updated_at | Yes | Audit |

Essential minimum for serving: programme/offering scope, intake, academic year, round, event type, deadline/window, timezone/precision, source URL, retrieved/verified time, validity and status.

### 5.4 Deadline record volume

| Scenario | Programme-intakes | Events per intake | Estimated timeline records |
| --- | ---: | ---: | ---: |
| Prototype | 250–500 | 4–8 | 1.000–4.000 |
| MVP | 1.500–5.000 | 6–10 | 10.000–50.000 |
| Production | 12.000–45.000 | 7–10 | 80.000–450.000 |
| Strong Production | 80.000–180.000 | 8–12 | 600.000–2.000.000 |

Nhiều programmes chỉ công bố 2–4 events. Không tạo record giả để đạt count; thiếu phải là explicit unknown coverage.

## 6. Training datasets by model contract

Một sample ở bảng này là contract-level training unit. Với VinUni V2 và streamed CV, một source bundle có thể được tách thành 2–3 pass-level SFT records nhưng phải giữ cùng bundle_id và cùng split.

| Contract | Minimum experiment | Good first production | Strong production | Diminishing returns | Main bottleneck |
| --- | ---: | ---: | ---: | ---: | --- |
| LOR review | 600–1.200 | 3.000–5.000 | 10.000–18.000 | 25.000–35.000 | Expert credibility/voice labels; recommender-type diversity |
| Strategy CV review | 800–1.500 | 4.000–7.000 | 12.000–22.000 | 35.000–50.000 | Programme-specific target profiles and verbatim evidence |
| Builder CV stream | 1.500–3.000 bundles | 7.000–12.000 | 20.000–35.000 | 50.000–75.000 | Long context, dynamic sections, complete ordered NDJSON, repair cases |
| Generic Essay review | 1.200–2.500 | 6.000–10.000 | 18.000–30.000 | 50.000–75.000 | High stylistic diversity; trustworthy replacement labels |
| VinUni AACC V2 | 1.500–3.000 bundles | 6.000–10.000 | 15.000–25.000 | 35.000–50.000 | Multi-pass evidence mapping, AACC expert scoring, rare pillars |
| Applicant Narrative | 800–1.500 | 4.000–7.000 | 12.000–20.000 | 30.000–40.000 | Avoiding generic traits and single-observation overgeneralization |
| Course Match dependency | 2.000–4.000 | 10.000–18.000 | 30.000–60.000 | 80.000–120.000 | Cross-product applicant×programme diversity, verified requirements, missing facts |

### Why the ranges differ

- LOR cần ít hơn Course Match về context diversity, nhưng expert labeling rất đắt vì credibility phụ thuộc recommender perspective.
- Strategy CV cần target-profile diversity; lặp lại nhiều CV với cùng programme không tăng nhiều giá trị.
- Streamed CV có output coverage lớn, two-pass generation, dynamic sections và repair behavior; record count phải bao phủ section combinations và malformed streams.
- Generic Essay có output đơn giản hơn VinUni nhưng style/prompt/discipline diversity rộng hơn.
- VinUni có domain hẹp hơn nhưng multi-pass grounding và AACC pillar annotation làm mỗi sample đắt và phức tạp.
- Applicant Narrative cần nhiều applicants độc lập hơn là nhiều versions của cùng profile.
- Course Match cần programme-held-out và temporal coverage; số pair tăng nhanh vì cùng applicant ghép với programme khác tạo reasoning khác.

Diminishing-return point giả định dữ liệu đã deduplicate, balanced và labels có chất lượng. Nếu label noise hoặc programme concentration cao, thêm record vẫn không đạt mức Strong.

## 7. Canonical training-record schemas

Training storage nên giữ canonical JSONL envelope, rồi compile thành prompt/completion hoặc conversational format khi train. SFT tooling hiện đại hỗ trợ cả prompt-completion và conversational records; giữ canonical domain record giúp không khóa data vào một tokenizer/template cụ thể. Tham khảo [Hugging Face TRL SFT dataset formats](https://huggingface.co/docs/trl/en/sft_trainer).

### 7.1 Shared envelope

~~~json
{
  "record_id": "uuid",
  "bundle_id": "all records from one applicant/document/model workflow",
  "applicant_group_id": "pseudonymous stable ID",
  "task": "one of seven contracts",
  "input_facts": {},
  "labels": {},
  "deterministic_outputs": {},
  "metadata": {
    "schema_version": "...",
    "rubric_version": "...",
    "prompt_version": "...",
    "source_hashes": [],
    "language": "...",
    "created_at": "...",
    "label_provenance": "gold|organic|silver|synthetic",
    "review_status": "accepted|edited|rejected"
  }
}
~~~

deterministic_outputs được lưu để replay/evaluate pipeline, nhưng không đưa vào completion loss nếu code có thể tính hoàn hảo.

### 7.2 LOR review

~~~json
{
  "task": "lor_review",
  "input_facts": {
    "letter_text": "...",
    "programme": {
      "university": "...",
      "programme": "...",
      "level": "...",
      "subject": "...",
      "entry_requirements": "...",
      "official_sources": []
    },
    "recommender_strategy": {
      "type": "...",
      "relationship": "...",
      "duration": "...",
      "perspective": "...",
      "prioritized_traits": [],
      "do_not_prioritize": []
    },
    "selected_evidence": []
  },
  "labels": {
    "dimensions": [],
    "summary": "...",
    "what_works": [],
    "improvements": [],
    "profile_coverage": [],
    "suggestions": []
  },
  "deterministic_outputs": {
    "valid_quotes": [],
    "overall_score_0_100": 0,
    "recommendation_label": "..."
  },
  "metadata": {
    "recommender_type": "...",
    "letter_length_bucket": "...",
    "evidence_completeness": "...",
    "reviewer_role": "admissions_consultant"
  }
}
~~~

Labels phải giữ replacement rỗng. Quote validity, dimension uniqueness và score aggregation không phải labels để model học.

### 7.3 Strategy CV review

~~~json
{
  "task": "cv_review_strategy",
  "input_facts": {
    "structured_cv": {"sections": []},
    "application_context": {},
    "target_profile": {
      "career_direction": "...",
      "university_positioning": "...",
      "education_philosophy": "...",
      "environment": "...",
      "programme_objectives": "...",
      "priority_capabilities": "...",
      "career_alignment": "..."
    }
  },
  "labels": {
    "strengths": [{"claim": "...", "verbatim_evidence": "..."}],
    "missing_signals": [{
      "signal": "...",
      "action": "...",
      "target_section": "...",
      "critical": false
    }],
    "summary": "...",
    "source_urls_used": []
  },
  "deterministic_outputs": {
    "source_urls_valid": true,
    "review_is_stale": false
  },
  "metadata": {
    "content_version": 1,
    "target_profile_version": 1,
    "programme_id": "...",
    "cv_format": "..."
  }
}
~~~

### 7.4 Builder/streamed CV review

~~~json
{
  "task": "cv_review_stream",
  "input_facts": {
    "segmented_cv": [{"id": "C001", "text": "...", "section": "..."}],
    "programme_target": {},
    "expected_sections": [],
    "pass_type": "criteria_summary|sections_recommendations|repair"
  },
  "labels": {
    "ordered_events": [
      {"type": "summary", "payload": {}},
      {"type": "criterion", "key": "...", "payload": {}},
      {"type": "section", "key": "...", "payload": {}},
      {"type": "recommendations", "payload": {}}
    ]
  },
  "deterministic_outputs": {
    "valid_evidence_ids": [],
    "missing_keys": [],
    "overall_score": 0,
    "final_event_order": []
  },
  "metadata": {
    "bundle_id": "...",
    "pass_index": 1,
    "document_source": "pdf|docx|paste",
    "document_quality": "clean|partial|unreadable",
    "repair_required": false
  }
}
~~~

Các pass của cùng CV phải nằm cùng split. Stream transport chunks không cần học nguyên xi; model cần học semantic event payload, còn server chịu trách nhiệm framing/order.

### 7.5 Generic Essay review

~~~json
{
  "task": "essay_review_generic",
  "input_facts": {
    "essay_text": "...",
    "document_type": "...",
    "target_university": "...",
    "tier_context": {
      "cv_summary": "...",
      "profile_summary": "...",
      "goals": "...",
      "grades": "...",
      "career_interests": "..."
    }
  },
  "labels": {
    "rubric_judgments": [],
    "summary": "...",
    "inline_suggestions": [{
      "original_text": "...",
      "replacement": "...",
      "reason": "..."
    }],
    "checklist": []
  },
  "deterministic_outputs": {
    "original_text_is_substring": true,
    "overall_score": 0
  },
  "metadata": {
    "essay_prompt_family": "...",
    "field": "...",
    "length_bucket": "...",
    "human_edit_accepted": null
  }
}
~~~

Current contract nhận model-generated overall score. Cho training, score nên được bắt nguồn từ human rubric judgments rồi aggregate deterministic; response shape vẫn có thể giữ overallScore.

### 7.6 VinUni AACC V2

~~~json
{
  "task": "essay_review_vinuni_v2",
  "input_facts": {
    "segmented_essay": [{"id": "U001", "text": "..."}],
    "essay_prompt": "...",
    "vinuni_profile": {},
    "programme_context": {},
    "profile_evidence": [],
    "aacc_rubric": {},
    "pass_type": "coverage|review_abce|review_d|repair"
  },
  "labels": {
    "coverage_map": [],
    "diagnostics": [],
    "requested_sections": {}
  },
  "deterministic_outputs": {
    "valid_evidence_refs": [],
    "missing_sections": [],
    "fallback_sections": [],
    "section_f_score": 0,
    "final_score": 0
  },
  "metadata": {
    "bundle_id": "...",
    "application_id_hash": "...",
    "requested_sections": [],
    "input_hash": "...",
    "fallback_used": false
  }
}
~~~

Một essay bundle tạo tối đa ba primary pass records và repair examples. Evaluation phải báo cả pass-level và assembled-report metrics.

### 7.7 Applicant Narrative

~~~json
{
  "task": "applicant_narrative",
  "input_facts": {
    "profile": {
      "nationality": "...",
      "qualification": "...",
      "school": "...",
      "year": "...",
      "subjects": [],
      "predicted_grades": "...",
      "career_goals": "...",
      "learning_style": "...",
      "interests": [],
      "personal_statement_answers": {}
    },
    "achievements": [],
    "activities": []
  },
  "labels": {
    "core_identity": "...",
    "learning_style": [],
    "academic_strengths": [],
    "growth_areas": [],
    "driving_force": "...",
    "signature_pattern": [],
    "emerging_themes": [],
    "personal_positioning": "...",
    "self_presentation_rubric": {}
  },
  "deterministic_outputs": {
    "inputs_present": {},
    "holistic_rating": 0
  },
  "metadata": {
    "profile_version": 1,
    "evidence_count": 0,
    "contradiction_tags": []
  }
}
~~~

Holistic rating nên aggregate từ reviewer rubric hoặc code, không học như một số cảm tính độc lập.

### 7.8 Course Match dependency

~~~json
{
  "task": "course_match_dependency",
  "input_facts": {
    "course": {
      "university": "...",
      "programme": "...",
      "subject": "...",
      "degree": "...",
      "requirements": {},
      "country": "...",
      "duration": "...",
      "mode": "...",
      "intake": "...",
      "tuition": {},
      "timeline_events": [],
      "scholarships": [],
      "official_source_facts": []
    },
    "candidate": {
      "academics": {},
      "tests": [],
      "activities": [],
      "achievements": [],
      "budget": {},
      "career_direction": "..."
    },
    "cv_text": "...",
    "essay_text": "..."
  },
  "labels": {
    "pillar_assessments": {
      "academic": {},
      "activities": {},
      "essays": {},
      "impact": {},
      "personal": {}
    },
    "requirement_comparisons": [],
    "programme_fit_narratives": {},
    "improvements": []
  },
  "deterministic_outputs": {
    "inputs_present": {},
    "eligibility": {},
    "current_weighted_score": 0,
    "max_weighted_score": 0,
    "classification": "...",
    "confidence_from_coverage": 0
  },
  "metadata": {
    "applicant_group_id": "...",
    "programme_id": "...",
    "programme_intake_id": "...",
    "fact_snapshot_hash": "...",
    "source_freshness": "..."
  }
}
~~~

Model label nên là evidence-grounded comparison/narrative. Hard eligibility, date comparison, weighted score và final classification ở deterministic_outputs.

## 8. Deterministic vs learned boundary

# DO NOT TRAIN THE MODEL TO LEARN THIS

| Deterministic component | Why remain deterministic | Data required | Model interaction |
| --- | --- | --- | --- |
| Auth, ownership, quota, rate limit | Security/product policy, không phải language behavior | User/application IDs, tier, counters | Không nhìn thấy hoặc chỉ nhận allowed context |
| JSON/schema/enum validation | Code chính xác và testable | Contract schema/version | Model sinh candidate output; validator accept/reject/repair |
| Evidence-ID validity | Membership check hoàn hảo trong code | Allowed IDs | Model chỉ chọn IDs |
| Quote substring verification | Exact string operation | Source document + quote | Model đề xuất quote; code xác minh |
| Uxxx/Cxxx segmentation and ID assignment | Stable reproducibility | Source text | Model tham chiếu IDs, không tạo namespace |
| LOR 85→100 aggregation and recommendation label | Arithmetic/rule mapping | Nine dimension scores | Model chấm rubric dimensions |
| Streamed CV overall score | Fixed weighted aggregation | Five criteria | Model tạo criterion judgments |
| VinUni rubric weights/F/final score | Versioned rubric arithmetic | Section scores + rubric version | Model tạo section evidence/judgment |
| Match weighted current/max score | Fixed pillar weights | Pillar outputs | Model tạo pillar assessments |
| Eligibility hard rules | Must be explainable and current | Normalized requirements + candidate facts | Model có thể extract/compare prose; code quyết định met/not_met |
| Reach/match/safety classification | Product rule, không phải probability | Deterministic academic/eligibility result | Model viết explanation sau classification |
| Deadline comparison/countdown | Timezone/date operation | Timeline event + current time | Model diễn giải status đã tính |
| Input coverage/confidence fallback | Presence/count rules ổn định | Available inputs/evidence | Model nêu limitations |
| Missing-section detection and repair routing | Set difference/state machine | Expected vs received keys | Model chỉ repair requested section |
| Stream event ordering/framing | Transport protocol | Event keys/index | Model sinh payload; server order/frame |
| Hashes, versioning, cache, staleness | Provenance/replay | Input snapshots, versions, timestamps | Không phải model output |
| F2/F3/F5 reshape and F6 vagueness heuristics | Current pure evaluation engine | Stored narrative/match/profile | Model supplies F1/F4 only |
| Official programme facts | Volatile source of truth | Runtime knowledge/provenance | Model consumes retrieved facts |

Training examples vẫn cần deterministic outputs để pipeline replay và error analysis, nhưng loss mask phải loại các value backend tự tính khi có thể.

## 9. Grounding and hard-negative requirements

### 9.1 Required hard-negative taxonomy

| Case | Expected label behavior | Highest-risk contracts |
| --- | --- | --- |
| Valid strong evidence | Cite/use with appropriate confidence | All |
| Weak evidence | Mark limited; no inflated trait/score | LOR, Narrative, Match |
| Missing evidence | Empty refs/unknown/limitation | All grounded contracts |
| Unsupported claim | Reject or remove | All |
| Contradictory evidence | Surface conflict; do not silently choose | Narrative, Match |
| Wrong-source evidence | Reject programme fact used as applicant proof or reverse | LOR, CV Strategy, VinUni, Match |
| Fabricated evidence | No new ID/quote/fact | All |
| Invalid evidence ID | Parser rejects; repair target | Stream CV, VinUni |
| Quote not found | Drop quote and flag | LOR, CV, Essay, Match |
| Single observation → personality trait | Mark insufficient pattern | Applicant Narrative |
| Applicant claim conflicts with CV | Surface contradiction/limitation | Narrative, Match |
| CV conflicts with essay | Do not merge as one fact | Match |
| Target-profile mismatch | Missing signal, not invented alignment | Strategy CV |
| Stale programme fact | Exclude or mark stale | Strategy CV, VinUni, Match |
| Hostile instruction in user/source text | Ignore instruction and use as data | All |

### 9.2 Composition

Recommended non-overlapping primary buckets:

| Bucket | Share | Definition |
| --- | ---: | --- |
| Normal/clean | 50–60% | Complete inputs, valid evidence, common document forms |
| Difficult but legitimate | 15–20% | Long, multilingual, subtle, unusual profile, mixed evidence strength |
| Incomplete/unknown | 15–20% | Missing document, source, requirement, evidence or profile section |
| Adversarial/edge | 10–15% | Injection, invalid IDs, contradictions, fabricated quote, malformed output |

Recommended hard-negative share by contract:

| Contract | Hard/incomplete/adversarial target |
| --- | ---: |
| LOR | 30–35% |
| Strategy CV | 25–35% |
| Stream CV | 25–35% |
| Generic Essay | 20–30% |
| VinUni V2 | 30–40% |
| Applicant Narrative | 30–40% |
| Course Match | 35–45% |

Hard negatives không chỉ là bad model outputs. Chúng cần corrected target output và reason tag để model học abstention, limitation hoặc evidence rejection.

## 10. Dataset diversity matrix

| Dimension | Required strata/coverage | Minimum control |
| --- | --- | --- |
| Applicant strength | weak, mixed, strong; không lấy acceptance làm proxy | Không bucket nào <20% trong eval |
| Evidence completeness | complete, partial, missing, contradictory | Partial+missing >=25%; contradictory >=8–10% |
| Academic field | STEM, computing, business, social science, humanities, health, arts/design, interdisciplinary | Ít nhất 8 clusters; mỗi cluster có eval riêng |
| Origin/curriculum | Vietnamese national, IB, A-level, AP/US, foundation, undergraduate-to-PG, other | Top curricula có >=200 eval cases khi production |
| Destination country | UK, US, Canada, Australia/NZ, Singapore/Asia, Europe and emerging markets | Programme-held-out per major market |
| Programme type | academic, professional, research, portfolio/audition, regulated | Không suy luận chỉ từ subject name |
| Degree level | foundation, undergraduate, taught postgraduate, research postgraduate | Contract-specific sampling |
| English proficiency | low, intermediate, advanced, native-like; code-switching | Không sửa thành native voice mặc định |
| Document quality | clean text, complex layout, OCR-noisy, partial, unreadable | Stream CV/document eval bắt buộc |
| Document length | short, median, long, max-limit | Stratify by token quartiles |
| CV format | chronological, skills-based, academic, one-page, multi-page, table-heavy | Dynamic-section coverage |
| Essay style | narrative, analytical, direct, fragmented, over-polished, formulaic | Generic/VinUni evaluation |
| Recommender type | teacher, counselor, employer, research supervisor, activity mentor, other | LOR rubric calibration per type |
| Career direction | clear, broad, changing, absent | Narrative/Match limitation behavior |
| Profile completeness | complete, sparse, no achievements, no tests, missing goals | Narrative/Match |
| Achievements | common, unusual, individual, team, unverifiable, contradictory | Evidence grounding |
| Programme specificity | rich official sources, minimal page, conflicting sources, stale page | Strategy CV/VinUni/Match |
| Language | Vietnamese output; English/Vietnamese/mixed inputs | Measure each separately |
| Temporal | current intake, next intake, expired/stale cycle | Runtime/OOD evaluation |
| Template/source | Common App-like, UCAS-like, institution-specific, free-form | Prevent template memorization |

Protected attributes may be retained in a restricted fairness-audit dataset when legally and ethically appropriate, but must not become shortcuts for score/quality predictions.

## 11. Train/validation/test and leakage strategy

### 11.1 Correct split unit

Primary split unit is applicant_group_id, not document. All CVs, essays, LORs, profile snapshots, achievements, activities, Narrative and Match records of one applicant stay in one split.

Additional grouping:

- All versions and near-duplicates of one document stay together.
- All pass-level records from one VinUni/stream-CV bundle stay together.
- Synthetic records from the same generation seed/template/batch stay together.
- Teacher-model variants of the same source input stay together.
- Course Match pairs sharing the same applicant follow applicant split; dedicated programme OOD set is built separately.

Group-based splitting is the appropriate pattern because groups must not overlap across folds; [scikit-learn GroupKFold](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GroupKFold.html) documents this exact non-overlap behavior.

### 11.2 Evaluation suites

| Suite | Design | Usefulness |
| --- | --- | --- |
| Standard IID | Applicant-group split, stratified by task/difficulty | Useful for regression and training iteration; not enough for launch |
| Applicant-held-out | Entire unseen applicants | Primary generalization test for all contracts |
| Programme-held-out | Unseen programmes, same universities/fields may remain | Essential for Strategy CV, VinUni and Course Match |
| University-held-out | Entire institutions unseen | Useful for university-specific language/source overfit |
| Temporal test | Sources/intakes created after training cutoff | Essential for runtime freshness and Course Match |
| Hard-case test | Curated contradictions, missing evidence, injection, invalid IDs, stale facts | Essential safety/grounding gate |

Suggested development split: 80% train, 10% validation, 10% applicant-held-out test, plus dedicated programme/university/temporal/hard suites outside that 10%.

### 11.3 Leakage checks

- Exact hash and normalized-text hash.
- MinHash/embedding near-duplicate clustering for CV/essay versions.
- Shared names/organizations/date sequences after de-identification.
- Same programme text snapshot across train and programme-held-out test.
- Same essay prompt/template family across splits.
- Same synthetic template or teacher batch across splits.
- Gold edit derived from a Silver output that already exists in test.

## 12. Gold/silver/synthetic data strategy

### 12.1 Recommended composition for MVP

| Provenance | Target share | Definition/use |
| --- | ---: | --- |
| Gold expert-reviewed | 35% | Expert-created or materially corrected target |
| Organic reviewed | 20% | Real user output with accepted edit/correction and quality checks |
| Silver validated | 30% | Existing GPT output passing deterministic validation plus sampled audit |
| Synthetic | 15% | Purpose-built gaps, contradictions, rare formats and adversarial cases |

Ranges are acceptable: Gold 30–40%, Organic 15–25%, Silver 25–35%, Synthetic 10–20%. Evaluation is 100% Gold/curated and contains no teacher-only labels.

### 12.2 Existing GPT outputs

Có thể dùng làm Silver nếu:

- Có exact input snapshot và contract/version metadata.
- Pass schema/evidence/source validators.
- Không đến từ fallback output giả định là model success.
- Deduplicated theo applicant/document.
- Random 10–20% được expert audit theo task.
- Các failure patterns từ audit được chuyển thành correction/hard-negative records.

Không được coi “user đã save” là đồng nghĩa với correct. Save có thể chỉ là UX persistence.

### 12.3 Safe and unsafe synthetic data

Safe:

- Missing-field combinations.
- Invalid evidence IDs/quotes.
- Prompt injections embedded in documents.
- Contradictory CV/essay/profile facts.
- Rare document layouts and lengths.
- Underrepresented curricula/programme types.
- Counterfactual programme facts supplied explicitly in context.

Unsafe without expert review:

- Synthetic admissions “truth”.
- Invented acceptance/rejection causality.
- Synthetic recommender voice used as Gold.
- Large batches from one teacher prompt.
- Paraphrase multiplication of the same applicant archetype.

### 12.4 Labeling strategy

| Contract | Trustworthy labeler | Preferred method | Human effort |
| --- | --- | --- | --- |
| LOR | Admissions consultant + experienced recommender/counselor | Rubric-level annotation, evidence verification, pairwise quality | VERY HIGH |
| Strategy CV | Admissions consultant/career adviser trained on target profile | Evidence spans + missing-signal annotation + pairwise preference | HIGH |
| Stream CV | Trained annotator for schema/evidence; consultant for strategy | Section-level annotation; critique/edit | MEDIUM–HIGH |
| Generic Essay | Admissions writing adviser | Pairwise preference, accepted edits, rubric critique; avoid free scalar only | HIGH |
| VinUni V2 | AACC-trained domain expert | Evidence map + pillar rubric + adjudication | VERY HIGH |
| Applicant Narrative | Trained consultant/psychometric-safe rubric reviewer | Evidence-backed theme confirmation/rejection | HIGH |
| Course Match | Programme-domain expert + admissions consultant | Requirement comparison, evidence quality, pairwise actionability | VERY HIGH |

Absolute scoring is least reliable for Generic Essay overall score, Applicant holistic rating and Course Match pillar scores. Prefer rubric-level judgments, ranking/pairwise preference, critique quality and evidence verification; aggregate scores deterministically.

Minimum human review targets:

- LOR, VinUni, Course Match: 50–60% of MVP train records.
- Strategy CV, Generic Essay, Applicant Narrative: 35–50%.
- Stream CV: 25–40%, while deterministic schema/evidence checks cover all records.
- All evaluation records: 100%.

Data provenance and review decisions should be documented as part of governance and testing; NIST’s AI Resource Center emphasizes testing/evaluation/verification/validation and risk documentation. See [NIST AIRC](https://airc.nist.gov/).

## 13. Evaluation dataset design

### 13.1 Metrics and sample counts

| Evaluation area | Metrics | MVP per applicable contract | Strong production |
| --- | --- | ---: | ---: |
| Structured output | Parse rate, required fields, enum/type correctness, complete sections | 500–1.000 | 2.000–5.000 |
| Evidence grounding | Citation precision/recall, unsupported claim rate, invalid ID/quote rate | 300–600 | 1.000–3.000 |
| Review quality | Correctness, specificity, usefulness, actionability, non-genericness | 250–500, double-reviewed | 1.000–2.000 |
| Safety/product behavior | Fabrication, admission probability, ghostwriting, unsupported university facts, injection | 200–400 curated | 800–2.000 |
| Consistency | Repeated-run score/judgment variance; cross-document consistency | 100–200 cases ×3 runs | 500–1.000 ×3 |
| Runtime performance | p50/p95 latency, token usage, timeout, repair/fallback rate, stream completeness | 1.000 requests per transport | 10.000+ shadow requests |

Counts are per applicable contract, not documents. A 500-case VinUni evaluation may contain multiple pass-level checks.

### 13.2 Contract-specific gates

| Contract | Required gate |
| --- | --- |
| LOR | 100% replacement empty; quote precision; dimension coverage; score deterministic |
| Strategy CV | Evidence exactness; target-profile specificity; no generic formatting drift |
| Stream CV | Complete ordered events; valid Cxxx IDs; missing-key/repair success; first-event latency |
| Generic Essay | originalText substring precision; no fabricated replacement facts; edit acceptance |
| VinUni | Uxxx/profile/programme reference precision; A–F completeness; fallback rate; rubric agreement |
| Applicant Narrative | unsupported-trait rate; repeated-pattern evidence; sparse-profile abstention |
| Course Match | verified-fact use; unknown handling; eligibility correctness; no probability claims |

### 13.3 Metric interpretation

- Schema validity alone chỉ chứng minh output parse được.
- Evidence precision phải đo claim-level, không chỉ record-level.
- Pairwise reviewer preference nên báo confidence interval và inter-rater agreement.
- Score consistency phải phân biệt acceptable wording variation với rubric-band drift.
- Runtime tests phải chạy đủ JSON, streaming, repair và cancellation paths.

## 14. Data freshness and provenance

### 14.1 Freshness policy

| Data type | Stability | Refresh/verification target |
| --- | --- | --- |
| University canonical identity/domain | Almost static | Quarterly diff; annual manual verification |
| Programme existence/title | Per academic cycle | Monthly; weekly during catalogue changes |
| Curriculum/modules/objectives | Yearly/per intake | Per intake; monthly change detection |
| Entry/subject/English requirements | Per intake | Monthly; weekly within 90 days of application deadline |
| Tuition/fees/deposit | Yearly/per intake | Monthly; weekly near offer/acceptance periods |
| Scholarships/financial aid | Monthly/seasonal | Monthly; weekly near deadlines |
| Application deadline/round | Per intake; high risk | Weekly; daily within 30 days; immediate on source change |
| Programme availability/rolling status | Weekly/monthly | Weekly in active recruitment season |
| Interview/decision/offer windows | Per intake | Weekly once published |
| Faculty profiles | Yearly/semester | P3; refresh per semester only if product consumes it |
| Rubric/prompt/schema | Product release cadence | Version on every change; immutable historical records |
| Applicant documents/profile | User-driven | Snapshot/hash on every relevant change |

### 14.2 Required provenance

Every unstable fact needs:

- source URL and source type;
- evidence quote/locator;
- retrieved_at and verified_at;
- effective programme/intake/round;
- valid_from and valid_until;
- confidence and verification status;
- content hash and supersession link;
- extraction pipeline/version.

### 14.3 Source conflict policy

1. Prefer official programme page over university-level general prose for programme-specific facts.
2. Prefer official application portal for round/deadline when scope is explicit.
3. Do not merge conflicting values into one prose string.
4. Store both claims with scopes and mark conflicted.
5. Block deterministic eligibility/deadline conclusion until resolved, or return unknown with sources.
6. Manual verify high-impact facts: deadline, hard eligibility, tuition/deposit and scholarship.

## 15. Data-volume scenarios

### 15.1 User/document data

| Data | Scenario 0 Prototype | Scenario 1 MVP | Scenario 2 Production | Scenario 3 Strong Production |
| --- | ---: | ---: | ---: | ---: |
| Unique applicants | 500–1.000 | 3.000–6.000 | 15.000–30.000 | 50.000–100.000 |
| CVs | 700–1.500 | 4.000–8.000 | 20.000–40.000 | 75.000–150.000 |
| Essays | 1.000–2.000 | 6.000–12.000 | 35.000–70.000 | 120.000–250.000 |
| LORs | 400–800 | 2.000–5.000 | 10.000–25.000 | 40.000–100.000 |
| Profile snapshots | 500–1.500 | 4.000–10.000 | 25.000–60.000 | 100.000–250.000 |

### 15.2 Programme knowledge

| Data | Prototype | MVP | Production | Strong Production |
| --- | ---: | ---: | ---: | ---: |
| Universities | 20–50 | 100–250 | 500–1.500 | 2.000–5.000 |
| Programmes | 150–300 | 1.000–3.000 | 8.000–25.000 | 50.000–100.000 |
| Programme-intakes | 250–500 | 1.500–5.000 | 12.000–45.000 | 80.000–180.000 |
| Requirement facts | 1.000–3.000 | 8.000–30.000 | 80.000–300.000 | 400.000–1.000.000 |
| Deadline/timeline events | 1.000–4.000 | 10.000–50.000 | 80.000–450.000 | 600.000–2.000.000 |
| Scholarships | 100–500 | 1.000–5.000 | 10.000–50.000 | 50.000–200.000 |

### 15.3 Training labels

| Data | Prototype | MVP | Production | Strong Production |
| --- | ---: | ---: | ---: | ---: |
| Total SFT records | 8.000–15.000 | 40.000–80.000 | 150.000–300.000 | 500.000–1.000.000 |
| Gold expert-reviewed | 3.000–5.000 | 14.000–28.000 | 50.000–100.000 | 150.000–300.000 |
| Organic reviewed | 1.000–2.000 | 8.000–16.000 | 30.000–70.000 | 100.000–250.000 |
| Silver validated | 3.000–6.000 | 12.000–28.000 | 50.000–120.000 | 150.000–350.000 |
| Hard/incomplete/adversarial | 1.500–3.000 | 8.000–18.000 | 30.000–70.000 | 100.000–250.000 |
| Preference pairs | 1.000–2.000 | 5.000–12.000 | 20.000–50.000 | 75.000–150.000 |

Các provenance classes cộng theo final mutually-exclusive label source; hard-negative là orthogonal tag nên nằm trong các classes khác và không cộng vào total lần nữa.

### 15.4 Evaluation

| Data | Prototype | MVP | Production | Strong Production |
| --- | ---: | ---: | ---: | ---: |
| Validation | 800–1.500 | 4.000–8.000 | 15.000–30.000 | 50.000–100.000 |
| Applicant-held-out test | 800–1.500 | 4.000–8.000 | 15.000–30.000 | 50.000–100.000 |
| Hard-case set | 300–600 | 1.500–3.000 | 5.000–12.000 | 20.000–40.000 |
| Temporal/programme/university OOD | 200–400 | 1.000–2.500 | 5.000–12.000 | 20.000–50.000 |

Scenario counts are system-wide. Contract-level minimums in Section 6 remain release gates; một total lớn không bù được contract thiếu data.

## 16. P0/P1/P2/P3 collection roadmap

| Priority | Dataset/source | Contains | Why | Approximate volume | Source | Difficulty | Refresh | Contracts |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| P0 | Consent/de-identification/lineage registry | Rights, PII removal, applicant/bundle IDs, hashes, versions | Không có thì không thể train/split/audit an toàn | 100% records | Product/backend | HIGH | Every change | All |
| P0 | Contract/rubric registry | Seven schemas, rubric/prompt versions, deterministic rules | Prevent label mixing | 7 contracts + immutable versions | Code/docs | LOW | Every release | All |
| P0 | Prototype applicant bundles | Profiles, CV, essays, LOR, achievements/activities | Source inputs and leakage groups | 500–1.000 applicants | Supabase/user-consented export | HIGH | Snapshot | All |
| P0 | Gold seed labels | Expert-corrected task records | Baseline learning/evaluation | 3.000–5.000 | Expert annotation | VERY HIGH | Versioned | All |
| P0 | Hard-negative seed | Missing/invalid/contradictory/injection cases | Grounding and abstention | 1.500–3.000 | Organic + curated synthetic | HIGH | Per failure | All |
| P0 | Verified programme facts | Programme/requirements/objectives/sources | Grounded programme context | 150–300 programmes; 1.000–3.000 requirements | Official sources/catalogue | HIGH | Monthly/per intake | LOR, CV Strategy, VinUni, Match |
| P0 | Timeline-event schema/data | Programme-intake-round events and provenance | Correct deadlines/readiness | 1.000–4.000 prototype events | Official sources | HIGH | Weekly/daily near deadline | Match/runtime |
| P1 | MVP applicant/document corpus | Broader real applicants/documents | Useful limited rollout | 3.000–6.000 applicants | Organic/partnerships | HIGH | Continuous | All |
| P1 | MVP SFT labels | Gold/organic/silver/synthetic records | Contract coverage | 40.000–80.000 | Mixed | VERY HIGH | Continuous | All |
| P1 | Organic edit/preference logging | AI output, final edit, accept/reject, reason | High-value feedback | 8.000–16.000 reviewed records | Product telemetry with consent | MEDIUM | Continuous | CV, Essay, LOR |
| P1 | Normalized requirements | Subject/qualification/language/document rules | Deterministic eligibility | 8.000–30.000 facts | Catalogue + manual QA | HIGH | Per intake | Match |
| P1 | Cross-document contradiction set | CV/essay/profile/LOR fact links and conflicts | Prevent silent merge | 1.000–3.000 bundles | Expert/curated | VERY HIGH | Continuous | Narrative, Match |
| P2 | Programme/university/temporal OOD suites | Held-out markets and future cycles | Generalization gate | 5.000–12.000 production cases | Official snapshots + Gold labels | HIGH | Per cycle | Programme-dependent |
| P2 | Preference pairs | Better/worse output judgments | Improve usefulness where scalar labels weak | 20.000–50.000 production | Expert/user review | HIGH | Continuous | Essay, CV, Narrative, Match |
| P2 | Multi-reviewer adjudication | Disagreement and consensus | Calibrate subjective rubrics | 10–20% Gold | Expert panel | VERY HIGH | Sampling | LOR, VinUni, Match |
| P3 | Historical admission outcomes | Resolved decisions, conditions, timestamps | Research only; not review-quality truth | 20.000 minimum; 50.000+ useful | Applicants/partners | VERY HIGH | Annual/cycle | Separate predictive research |
| P3 | Faculty/research-group data | Faculty, labs, availability | Only if future product consumes it | Scope-dependent | Official sources | HIGH | Semester/yearly | Future |

## 17. Critical answers

### 1. What data do we already have implicitly?

Applicant profiles, academic facts, achievements/activities, CV/essay/LOR text, recommender strategy, programme/university facts, selected evidence, AACC/other rubrics, model outputs, deterministic validators/scores, application records, intake/deadline fragments and partial provenance/version metadata.

### 2. What critical data is still missing?

Unified applicant/bundle IDs for splitting, consent/de-identification lineage, normalized programme-intake requirements, normalized timeline events, consistent prompt/schema/model provenance, accepted/edited/rejected feedback, cross-document contradiction labels and complete Gold evaluation sets.

### 3. Do we need deadline data?

Yes. It is required for eligibility/readiness, task planning, scholarship timing and trustworthy product behavior.

### 4. Should deadline data be training data?

Deadline values should not be model parameters. They are runtime database facts. Training only needs examples showing how to use supplied values and abstain when unknown/stale.

### 5. Approximately how many deadline records are needed?

Prototype 1.000–4.000; MVP 10.000–50.000; production 80.000–450.000. Assumption: 6–10 meaningful events per active programme-intake at MVP.

### 6. Approximately how many programmes initially?

150–300 to prove the system; 1.000–3.000 for useful MVP across several markets and fields.

### 7. Approximately how many real applicants?

500–1.000 for experiment; 3.000–6.000 for MVP; 15.000–30.000 for production. More versions from the same applicant do not replace unique applicants.

### 8. How many labeled examples per contract?

Use Section 6: experiment ranges from 600–4.000 per contract; first-production ranges from 3.000–18.000. Course Match requires most; LOR and VinUni require the highest expert-review share.

### 9. Can existing GPT outputs be used as labels?

Yes, as Silver only after exact input reconstruction, version/provenance capture, schema/evidence validation, deduplication and sampled expert audit. They become Gold only after human acceptance or correction.

### 10. What percentage should be human-reviewed?

Overall MVP target 35–45%. LOR, VinUni and Course Match 50–60%; all evaluation data 100%.

### 11. Which data should never become model parameters?

Current programme facts, requirements, tuition, scholarships, deadlines, official URLs, eligibility rules, rubric weights, score arithmetic, ID validity, quote matching, hashes, versions, cache state, auth/quota and application outcomes treated as causal truth.

### 12. Minimum dataset to start an experiment?

500–1.000 applicants, 700–1.500 CVs, 1.000–2.000 essays, 400–800 LORs, 150–300 verified programmes, 1.000–4.000 timeline events, 8.000–15.000 SFT records and 3.000–5.000 Gold records.

### 13. Dataset enough for MVP?

3.000–6.000 applicants, 40.000–80.000 SFT records, 14.000–28.000 Gold, 1.000–3.000 programmes, 10.000–50.000 timeline events and dedicated applicant/programme/hard/OOD evaluation suites.

### 14. Production-grade dataset?

15.000–30.000 applicants, 150.000–300.000 SFT records, 50.000–100.000 Gold, 8.000–25.000 programmes, 80.000–450.000 timeline events, 15.000–30.000 applicant-held-out test records and 5.000–12.000 hard/OOD cases.

### 15. Top five ways a large dataset can still fail

1. Correlated applicant/documents leak across splits, making metrics falsely high.
2. GPT/Synthetic labels reinforce the same hallucinations and style until the dataset collapses around teacher behavior.
3. Stale programme/deadline facts are mixed into SFT and become memorized misinformation.
4. Applicant, curriculum, field, country, recommender and document-format coverage is concentrated around one archetype.
5. Subjective scalar scores are noisy or confounded, while evidence correctness and actionable quality remain unlabeled.

## 18. Risks and failure modes

| Risk | Severity | Detection | Mitigation |
| --- | --- | --- | --- |
| Applicant/document leakage | Critical | Cross-split hash/entity graph | Applicant-group split; bundle grouping |
| Teacher-model self-reinforcement | Critical | Gold-vs-Silver error comparison | Cap Silver; expert audit/corrections |
| Runtime facts accidentally trained | Critical | Dataset field audit | Separate runtime knowledge store from SFT export |
| Stale deadlines/requirements | Critical | Freshness/conflict dashboards | Event/fact versions, expiry, refresh and manual QA |
| Synthetic distribution collapse | High | Template/embedding cluster concentration | Batch grouping, diversity caps, real/Gold minimum |
| Expert label disagreement | High | Inter-rater agreement | Rubric training, pairwise labels, adjudication |
| Evidence-ID/quote hallucination | High | Exact validators | Hard negatives and deterministic rejection |
| Generic feedback despite valid JSON | High | Human specificity/actionability metric | Gold critiques and preference pairs |
| Hidden admissions confounders | Critical if outcomes used | Temporal/fairness analysis | Keep outcomes separate; no causal/probability claim |
| PII or consent violation | Critical | Export scan/audit | De-identification, rights registry, restricted access |
| Multi-contract label contamination | High | Task/schema mismatch checks | Separate task records, sampling and eval gates |
| Streaming pass incompleteness | High | Event completeness/repair metrics | Pass-level records, deterministic ordering/repair |

The minimum sufficient system is therefore not “collect as many documents as possible.” It is:

- a small but correctly grouped applicant corpus;
- separate Gold labels for each contract;
- verified runtime programme/timeline knowledge;
- explicit hard negatives and missing-data behavior;
- deterministic enforcement for arithmetic, IDs, eligibility and freshness;
- evaluation that holds out applicants, programmes, universities and future time.
