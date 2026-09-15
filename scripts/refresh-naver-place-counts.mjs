#!/usr/bin/env node

/**
 * Firestore의 gourmet_lists를 순회하여 네이버 지도 저장 리스트의 장소 수를 갱신합니다.
 *
 * 사용 예시:
 *   pnpm install
 *   pnpm exec playwright install chromium
 *   node scripts/refresh-naver-place-counts.mjs --service-account C:\\secure\\firebase-admin.json --dry-run
 *   node scripts/refresh-naver-place-counts.mjs --service-account C:\\secure\\firebase-admin.json
 */

import { readFile } from 'node:fs/promises';
import { createSign } from 'node:crypto';
import process from 'node:process';
import { chromium } from 'playwright';

const COLLECTION = 'gourmet_lists';
const TOKEN_SCOPE = 'https://www.googleapis.com/auth/datastore';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MAX_ERROR_LENGTH = 300;

function printUsage() {
  console.log(`
네이버 지도 리스트 장소 수 갱신기

필수:
  --service-account <path>  Firebase Admin SDK 서비스 계정 JSON 파일 경로

선택:
  --dry-run                 Firestore에 쓰지 않고 결과만 출력
  --limit <number>          처리할 최대 게시글 수
  --headful                 브라우저 창을 표시
  --project-id <id>         서비스 계정의 프로젝트 ID 대신 사용할 값
`);
}

function parseArgs(args) {
  const options = { dryRun: false, headful: false, limit: Number.MAX_SAFE_INTEGER, projectId: '' };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--headful') {
      options.headful = true;
    } else if (arg === '--service-account') {
      options.serviceAccountPath = args[++index];
    } else if (arg === '--project-id') {
      options.projectId = args[++index];
    } else if (arg === '--limit') {
      options.limit = Number(args[++index]);
    } else {
      throw new Error(`알 수 없는 옵션입니다: ${arg}`);
    }
  }

  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error('--limit은 1 이상의 정수여야 합니다.');
  }
  return options;
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    scope: TOKEN_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsignedToken = `${header}.${claimSet}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key, 'base64url');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedToken}.${signature}`
    })
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google 인증 토큰 발급 실패: ${payload.error_description || payload.error || response.status}`);
  }
  return payload.access_token;
}

async function firestoreRequest(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(`Firestore 요청 실패 (${response.status}): ${payload?.error?.message || '알 수 없는 오류'}`);
  }
  return payload;
}

async function getListDocuments(projectId, accessToken) {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${COLLECTION}`;
  const documents = [];
  let nextPageToken = '';

  do {
    const url = new URL(baseUrl);
    url.searchParams.set('pageSize', '100');
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);
    const payload = await firestoreRequest(url, accessToken);
    documents.push(...(payload.documents || []));
    nextPageToken = payload.nextPageToken || '';
  } while (nextPageToken);

  return documents;
}

function getStringField(document, fieldName) {
  return document.fields?.[fieldName]?.stringValue?.trim() || '';
}

function getDocumentId(document) {
  return document.name.split('/').pop();
}

function getErrorMessage(error) {
  return String(error?.message || error).replace(/\s+/g, ' ').slice(0, MAX_ERROR_LENGTH);
}

async function resolvePlaceCount(page, naverUrl) {
  await page.goto(naverUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  let targetFrame;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    targetFrame = page.frames().find((frame) =>
      frame.url().includes('pages.map.naver.com/save-pages/pc/detail-list/')
    );
    if (targetFrame) break;
    await page.waitForTimeout(500);
  }

  if (!targetFrame) {
    throw new Error('공개 저장 리스트 화면을 찾지 못했습니다. 비공개 링크이거나 네이버 화면 구조가 변경되었을 수 있습니다.');
  }

  await targetFrame.getByText('저장된 장소 수', { exact: false }).waitFor({ state: 'visible', timeout: 15000 });
  const bodyText = await targetFrame.locator('body').innerText({ timeout: 15000 });
  const match = bodyText.match(/저장된\s*장소\s*수\s*([\d,]+)\s*(?:개|곳)/);
  if (!match) {
    throw new Error('저장된 장소 수 문구에서 숫자를 찾지 못했습니다.');
  }

  const placeCount = Number(match[1].replaceAll(',', ''));
  if (!Number.isInteger(placeCount) || placeCount < 0) {
    throw new Error(`읽어온 장소 수가 올바르지 않습니다: ${match[1]}`);
  }
  return placeCount;
}

function fieldsForResult({ placeCount, error }) {
  const now = new Date().toISOString();
  return {
    placeCount: placeCount === undefined ? { nullValue: null } : { integerValue: String(placeCount) },
    placeCountUpdatedAt: { timestampValue: now },
    placeCountStatus: { stringValue: error ? 'error' : 'success' },
    placeCountError: error ? { stringValue: error } : { nullValue: null }
  };
}

async function saveResult(projectId, accessToken, documentId, result) {
  const fieldNames = ['placeCount', 'placeCountUpdatedAt', 'placeCountStatus', 'placeCountError'];
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${COLLECTION}/${encodeURIComponent(documentId)}`
  );
  fieldNames.forEach((fieldName) => url.searchParams.append('updateMask.fieldPaths', fieldName));

  await firestoreRequest(url, accessToken, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fields: fieldsForResult(result) })
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const serviceAccountPath = options.serviceAccountPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!serviceAccountPath) {
    throw new Error('--service-account 또는 GOOGLE_APPLICATION_CREDENTIALS가 필요합니다.');
  }

  const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
  if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
    throw new Error('서비스 계정 JSON에 client_email, private_key, project_id가 모두 필요합니다.');
  }

  const projectId = options.projectId || serviceAccount.project_id;
  const accessToken = await getAccessToken(serviceAccount);
  const documents = (await getListDocuments(projectId, accessToken)).slice(0, options.limit);
  const browser = await chromium.launch({ headless: !options.headful });
  const page = await browser.newPage({ locale: 'ko-KR' });
  const summary = { total: documents.length, success: 0, failed: 0, skipped: 0 };

  try {
    for (const document of documents) {
      const documentId = getDocumentId(document);
      const naverUrl = getStringField(document, 'naverUrl');

      if (!naverUrl) {
        summary.skipped += 1;
        console.warn(`[건너뜀] ${documentId}: naverUrl 값이 없습니다.`);
        continue;
      }

      try {
        const placeCount = await resolvePlaceCount(page, naverUrl);
        summary.success += 1;
        console.log(`[성공] ${documentId}: ${placeCount}곳`);
        if (!options.dryRun) {
          await saveResult(projectId, accessToken, documentId, { placeCount });
        }
      } catch (error) {
        const message = getErrorMessage(error);
        summary.failed += 1;
        console.error(`[실패] ${documentId}: ${message}`);
        if (!options.dryRun) {
          await saveResult(projectId, accessToken, documentId, { error: message });
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`완료: ${summary.total}건 중 성공 ${summary.success}, 실패 ${summary.failed}, 건너뜀 ${summary.skipped}${options.dryRun ? ' (dry-run)' : ''}`);
}

main().catch((error) => {
  console.error(`실행 중단: ${getErrorMessage(error)}`);
  process.exitCode = 1;
});
