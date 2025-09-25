import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from "k6/metrics";
import Hashids from "https://cdn.jsdelivr.net/npm/hashids@2.3.0/+esm";

const BASE_URL = 'https://q-asker.com'
const PROBLEM_SET_ID_MAX = 1156

const problemSetGenerationRequestDuration = new Trend("problem_set_generation_duration");
const problemSetGetRequestDuration = new Trend("problem_set_get_duration");
const explanationGetRequestDuration = new Trend("explanation_get_duration");

export const options = {
  scenarios: {
    load_pattern: {
      executor: "ramping-arrival-rate",
      startRate: 10,        // 시작은 분당 10 req (≈0.17 RPS)
      timeUnit: "1m",       // rate 기준 단위
      preAllocatedVUs: 20,  // 충분히 크게 잡기
      maxVUs: 100,

      stages: [
        { target: 79, duration: "5m" },  // Ramp-up: 10 → 79 req/min (≈1.31 RPS)
        { target: 79, duration: "5m" },  // Peak 유지
        { target: 10, duration: "5m" },  // Ramp-down
      ],
    },
  },
  thresholds: {
    problem_set_generation_duration: ["avg<200"], 
    problem_set_get_duration: ["avg<200"], 
    explanation_get_duration: ["avg<200"], 
  },
}
function generateRandomProblemSetId(){
    const salt = __ENV.SALT;
    const minLength = parseInt(__ENV.MIN_LENGTH) || 6;
    const hashids = new Hashids(salt, minLength);
    const randomId = Math.floor(Math.random() * PROBLEM_SET_ID_MAX) + 1;
    return hashids.encode(randomId);
}


export default function () {
    // 1. mocking ai server에 대한 문제 생성 테스트
    const generationUrl = `${BASE_URL}:8001/generationMock`;
    const generationData = JSON.stringify({
        uploadedUrl: "uploadedUrl",
        quizCount: 5,
        quizType: "MULTIPLE",
        difficultyType: "RECALL",
        pageNumbers: [1,2,3,4,5]
    });
    const generationRes = http.post(generationUrl, generationData, {
        headers: { 'Content-Type': 'application/json' }
    });
    problemSetGenerationRequestDuration.add(generationRes.timings.duration);
    check(generationRes, { '문제 생성 성공': (r) => r.status === 200 })
    const problemSetId = generateRandomProblemSetId();

    // 2. 생성된 problemSetId를 이용한 문제 세트 가져오기 테스트
    const problemSetUrl = `${BASE_URL}:8000/problem-set/:${problemSetId}`;
    const problemSetRes = http.get(problemSetUrl);
    problemSetGetRequestDuration.add(problemSetRes.timings.duration);
    check(problemSetRes, { '문제 세트 가져오기 성공': (r) => r.status === 200 });

    // 3. 생성된 problemSetId를 이용한 해설 가져오기 테스트
    const explanationUrl = `${BASE_URL}:8000/explanation/:${problemSetId}`;
    const explanationRes = http.get(explanationUrl);
    explanationGetRequestDuration.add(explanationRes.timings.duration);
    check(explanationRes, { '해설 반환 성공': (r) => r.status === 200 });
}