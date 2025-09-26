import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from "k6/metrics";
import Hashids from "https://cdn.jsdelivr.net/npm/hashids@2.3.0/+esm";

const BASE_URL = 'https://api.q-asker.com'
const PROBLEM_SET_ID_MAX = 1156
const CRITERION = 200 // ms

const problemSetGenerationRequestDuration = new Trend("problem_set_generation_duration");
const problemSetGetRequestDuration = new Trend("problem_set_get_duration");
const explanationGetRequestDuration = new Trend("explanation_get_duration");

const generationSuccess = new Counter("gen_success");
const generationFail = new Counter("gen_fail");
const generationUnder = new Counter("gen_under")
const generationOver = new Counter("gen_over")

const problemSetGetSuccess = new Counter("prob_success");
const problemSetGetFail = new Counter("prob_fail");
const problemSetGetUnder = new Counter("prob_under")
const problemSetGetOver = new Counter("prob_over")

const explanationSuccess = new Counter("exp_success");
const explanationFail = new Counter("exp_fail");
const explanationUnder = new Counter("exp_under")
const explanationOver = new Counter("exp_over")

export const options = {
  scenarios: {
  // warm up - 5분 동안 약 0.5 RPS 유지 (서서히 준비 단계)
  warm_up: {
    executor: "constant-arrival-rate",
    rate: 0.5,              // 초당 0.5 요청
    duration: "5m",
    timeUnit: "1s",
    preAllocatedVUs: 2,
    maxVUs: 10,
  },
  // peak load - 5분 동안 1.5 RPS 유지
  high_peak_load: {
    executor: "constant-arrival-rate",
    rate: 1.5,             // 초당 1.5 요청
    duration: "5m",
    timeUnit: "1s",
    startTime: "5m",
    preAllocatedVUs: 5,
    maxVUs: 20,
  },
  // cool down - 다시 0.5 RPS로 감소
  cool_down: {
    executor: "constant-arrival-rate",
    rate: 0.5,              // 초당 0.5 요청
    duration: "5m",
    timeUnit: "1s",
    startTime: "10m",
    preAllocatedVUs: 2,
    maxVUs: 10,
  },
},

  thresholds: {
    problem_set_generation_duration: [`avg<${CRITERION}`], 
    problem_set_get_duration: [`avg<${CRITERION}`], 
    explanation_get_duration: [`avg<${CRITERION}`], 
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
    const generationUrl = `${BASE_URL}/generationMock`;
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
    generationRes.status === 200  ? generationSuccess.add(1) : generationFail.add(1);
    (generationRes.timings.duration<CRITERION&&generationRes.status === 200) ? generationUnder.add(1) : generationOver.add(1);

    const problemSetId = generateRandomProblemSetId();

    // 2. 생성된 problemSetId를 이용한 문제 세트 가져오기 테스트
    const problemSetUrl = `${BASE_URL}/problem-set/:${problemSetId}`;
    const problemSetRes = http.get(problemSetUrl);
    problemSetGetRequestDuration.add(problemSetRes.timings.duration);
    problemSetRes.status === 200  ? problemSetGetSuccess.add(1) : problemSetGetFail.add(1);
    (problemSetRes.timings.duration<CRITERION&&problemSetRes.status === 200) ? problemSetGetUnder.add(1) : problemSetGetOver.add(1);

    // 3. 생성된 problemSetId를 이용한 해설 가져오기 테스트
    const explanationUrl = `${BASE_URL}/explanation/:${problemSetId}`;
    const explanationRes = http.get(explanationUrl);
    explanationGetRequestDuration.add(explanationRes.timings.duration);
    generationRes.status === 200  ? explanationSuccess.add(1) : explanationFail.add(1);
    (generationRes.timings.duration<CRITERION&&generationRes.status === 200) ? explanationUnder.add(1) : explanationOver.add(1);
  }