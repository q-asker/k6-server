import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'https://www.q-asker.com'
const testFile = open('./testFile.pdf','b');

const VUS = __ENV.VUS ? parseInt(__ENV.VUS) : 100;
const DURATION = __ENV.DURATION || '1m';

export const options = {
    vus: VUS,
    duration: DURATION,
};

export default function () {
    // 1. /s3/upload
    const uploadUrl = `${BASE_URL}/s3/upload`;
    const uploadData  = {
        file: http.file(testFile, 'testFile.pdf', 'application/pdf'),
    };   
    const uploadRes = http.post(uploadUrl, uploadData, {
        tags: { name: 'API_S3_Upload' },
    });
    check(uploadRes, { 'S3 업로드 성공': (r) => r.status === 200 }) || fail('S3 업로드 실패');
    const uploadedUrl = uploadRes.json('uploadedUrl'); // 응답

    // 2. /generation
    const generationUrl = `${BASE_URL}/generation`;
    const generationData = JSON.stringify({
        uploadedUrl: uploadedUrl,
        quizCount: 5,
        quizType: "MULTIPLE",
        difficultyType: "RECALL",
        pageNumbers: [1,2,3,4,5]
    });
    const generationRes = http.post(generationUrl, generationData, {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'API_Generate_Problem' },
    });
    check(generationRes, { '문제 생성 성공': (r) => r.status === 200 })|| fail('문제 생성 실패');
    const problemSetId = generationRes.json('problemSetId'); // 응답 
    
    // 3. /explanation
    const explanationUrl = `${BASE_URL}/explanation/:${problemSetId}`;
    const explanationRes = http.get(explanationUrl, {
        tags: { name: 'API_Grade_And_Explain' },
    });
    check(explanationRes, { '해설 반환 성공': (r) => r.status === 200 })|| fail('해설 반환 실패');
    sleep(1); 
}