import {expect, Page, test} from '@playwright/test';

const STORAGE_KEY = 'jcbc-demo.inquiries.v1';
const loadedAt = '2026-11-18T01:02:03.456Z';
const base = {
  content: 'API本文',
  status: '未対応',
  priority: '高',
  memo: '保存済み',
};
const dated = [
  {id: 'a', title: 'API A', createdAt: '2026-01-01T00:00:00.200Z'},
  {id: 'b', title: 'API B', createdAt: '2026-01-01T00:00:00.100Z'},
  {id: 'c', title: 'API C', createdAt: '2026-01-01T00:00:00.200Z'},
  {id: 'd', title: 'API D', createdAt: '2026-01-01T00:00:00.300Z'},
].map(item => ({...base, ...item, createdAtEstimated: false}));

async function seed(page: Page, items: unknown[]): Promise<void> {
  await page.clock.setFixedTime(new Date(loadedAt));
  await page.addInitScript(
    ({key, items}) => {
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, JSON.stringify(items));
      }
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'jcbc-demo.inquiries.v1') {
          const writes = Number(sessionStorage.getItem('writes') ?? 0);
          sessionStorage.setItem('writes', String(writes + 1));
          if (sessionStorage.getItem('fail-save') === 'true') {
            throw new DOMException('Full', 'QuotaExceededError');
          }
        }
        setItem.call(this, key, value);
      };
    },
    {key: STORAGE_KEY, items},
  );
  await page.goto('/');
}

async function storage(
  page: Page,
): Promise<{raw: string | null; writes: string | null}> {
  return page.evaluate(
    key => ({
      raw: localStorage.getItem(key),
      writes: sessionStorage.getItem('writes'),
    }),
    STORAGE_KEY,
  );
}

const headings = (page: Page) => page.locator('article h3');
const card = (page: Page, title: string) =>
  page.getByRole('article').filter({
    has: page.getByRole('heading', {name: title, exact: true}),
  });

test('ミリ秒順・安定順を即時反映し条件とID別下書きを維持し保存しない', async ({
  page,
}) => {
  await seed(page, dated);
  const sort = page.getByLabel('並び順', {exact: true});
  await expect(sort).toHaveValue('newest');
  await expect(headings(page)).toHaveText(['API D', 'API A', 'API C', 'API B']);
  await card(page, 'API A').getByLabel('対応メモ').fill('Aの下書き');
  await card(page, 'API C').getByLabel('対応メモ').fill('Cの下書き');
  const before = await storage(page);
  await sort.selectOption('oldest');
  await expect(headings(page)).toHaveText(['API B', 'API A', 'API C', 'API D']);
  await page.getByLabel('キーワード検索（件名・内容）').fill('api');
  await page.getByLabel('対応状況で絞り込み').selectOption('未対応');
  await page.getByLabel('優先度で絞り込み').selectOption('高');
  await sort.selectOption('newest');
  await expect(headings(page)).toHaveText(['API D', 'API A', 'API C', 'API B']);
  await sort.selectOption('oldest');
  await expect(headings(page)).toHaveText(['API B', 'API A', 'API C', 'API D']);
  await expect(page.getByLabel('キーワード検索（件名・内容）')).toHaveValue(
    'api',
  );
  await expect(page.getByLabel('対応状況で絞り込み')).toHaveValue('未対応');
  await expect(page.getByLabel('優先度で絞り込み')).toHaveValue('高');
  await page.getByLabel('キーワード検索（件名・内容）').fill('API B');
  await sort.selectOption('newest');
  await expect(headings(page)).toHaveText(['API B']);
  await page.getByLabel('キーワード検索（件名・内容）').fill('api');
  await expect(card(page, 'API A').getByLabel('対応メモ')).toHaveValue(
    'Aの下書き',
  );
  await expect(card(page, 'API C').getByLabel('対応メモ')).toHaveValue(
    'Cの下書き',
  );
  await expect(card(page, 'API B').getByLabel('対応メモ')).toHaveValue(
    '保存済み',
  );
  expect(await storage(page)).toEqual(before);
  await sort.selectOption('oldest');
  await page.reload();
  await expect(sort).toHaveValue('newest');
  expect(await storage(page)).toEqual(before);
});

test('検索・状態・優先度のAND結果を同時刻の保存順のまま並べ替える', async ({
  page,
}) => {
  await seed(page, [
    dated[0],
    {...dated[1], status: '完了'},
    dated[2],
    {...dated[3], priority: '低'},
    {...dated[0], id: 'e', title: '対象外', content: '別内容'},
  ]);
  await page.getByLabel('キーワード検索（件名・内容）').fill('api');
  await page.getByLabel('対応状況で絞り込み').selectOption('未対応');
  await page.getByLabel('優先度で絞り込み').selectOption('高');
  for (const order of ['oldest', 'newest']) {
    await page.getByLabel('並び順', {exact: true}).selectOption(order);
    await expect(headings(page)).toHaveText(['API A', 'API C']);
  }
});

test('JSONの空白やプロパティ順だけでは起動時に保存しない', async ({page}) => {
  await seed(page, dated);
  const original = JSON.stringify(
    dated.map(item => ({
      createdAtEstimated: item.createdAtEstimated,
      createdAt: item.createdAt,
      ...base,
      title: item.title,
      id: item.id,
    })),
    null,
    2,
  );
  await page.evaluate(
    ({key, original}) => localStorage.setItem(key, original),
    {
      key: STORAGE_KEY,
      original,
    },
  );
  const before = await storage(page);
  await page.reload();
  await expect(headings(page)).toHaveText(['API D', 'API A', 'API C', 'API B']);
  expect(await storage(page)).toEqual(before);
});

for (const invalid of [
  {id: 'broken', title: '', ...base},
  {...dated[0], createdAtEstimated: 'invalid'},
  {...dated[0], createdAt: null, memo: 123},
]) {
  test(`不正な日時以外のデータを補完保存で救済しない: ${JSON.stringify(invalid)}`, async ({
    page,
  }) => {
    await seed(page, [invalid]);
    await expect(page.getByRole('alert')).toContainText(
      '保存データを読み込めません',
    );
    await expect(page.getByLabel('並び順', {exact: true})).toBeDisabled();
    await expect(page.getByRole('article')).toHaveCount(0);
    expect(await storage(page)).toEqual({
      raw: JSON.stringify([invalid]),
      writes: null,
    });
  });
}

test('新規登録の保存失敗は入力と日時を守り再試行時の日時で登録する', async ({
  page,
}) => {
  await seed(page, dated);
  const before = (await storage(page)).raw;
  await page.evaluate(() => sessionStorage.setItem('fail-save', 'true'));
  await page.getByLabel('件名（必須・100文字以内）').fill('再試行の件名');
  await page.getByLabel('内容（必須・1,000文字以内）').fill('再試行の内容');
  await page.getByRole('button', {name: '登録する', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('保存できませんでした');
  await expect(page.getByLabel('件名（必須・100文字以内）')).toHaveValue(
    '再試行の件名',
  );
  await expect(page.getByLabel('内容（必須・1,000文字以内）')).toHaveValue(
    '再試行の内容',
  );
  await expect(page.locator('#notice')).toBeEmpty();
  expect((await storage(page)).raw).toBe(before);
  await page.evaluate(() => sessionStorage.setItem('fail-save', 'false'));
  await page.clock.setFixedTime(new Date('2027-01-02T03:04:05.678Z'));
  await page.getByRole('button', {name: '登録する', exact: true}).click();
  await expect(page.getByRole('article')).toHaveCount(5);
  const saved = JSON.parse((await storage(page)).raw!);
  expect(saved.slice(0, 4)).toEqual(dated);
  expect(saved[4]).toMatchObject({
    createdAt: '2027-01-02T03:04:05.678Z',
    createdAtEstimated: false,
  });
});

test('古い順を登録と各編集でも維持し日時2項目と保存配列順を保護する', async ({
  page,
}) => {
  await seed(page, dated);
  const sort = page.getByLabel('並び順', {exact: true});
  await sort.selectOption('oldest');
  await page.getByLabel('キーワード検索（件名・内容）').fill('api');
  await page.getByLabel('対応状況で絞り込み').selectOption('未対応');
  await page.getByLabel('優先度で絞り込み').selectOption('中');
  await page.getByLabel('件名（必須・100文字以内）').fill('API新規');
  await page.getByLabel('内容（必須・1,000文字以内）').fill('合成内容');
  await page.getByRole('button', {name: '登録する', exact: true}).click();
  await expect(headings(page)).toHaveText(['API新規']);
  await expect(sort).toHaveValue('oldest');
  await expect(page.getByLabel('キーワード検索（件名・内容）')).toHaveValue(
    'api',
  );
  await expect(page.getByLabel('対応状況で絞り込み')).toHaveValue('未対応');
  await expect(page.getByLabel('優先度で絞り込み')).toHaveValue('中');
  await expect(card(page, 'API新規')).toContainText(
    '登録日時：2026/11/18 10:02:03',
  );
  const afterRegistration = JSON.parse((await storage(page)).raw!);
  expect(afterRegistration.slice(0, 4)).toEqual(dated);
  expect(afterRegistration[4]).toMatchObject({
    createdAt: loadedAt,
    createdAtEstimated: false,
  });
  await page.getByLabel('対応状況で絞り込み').selectOption('すべて');
  await page.getByLabel('優先度で絞り込み').selectOption('すべて');
  await expect(headings(page)).toHaveText([
    'API B',
    'API A',
    'API C',
    'API D',
    'API新規',
  ]);
  await page.clock.setFixedTime(new Date('2027-01-01T00:00:00.000Z'));
  const added = card(page, 'API新規');
  await added.getByLabel('対応状況').selectOption('完了');
  await expect(sort).toHaveValue('oldest');
  await added.getByLabel('優先度').selectOption('低');
  await expect(sort).toHaveValue('oldest');
  await added.getByLabel('対応メモ').fill('保存メモ');
  await added.getByRole('button', {name: 'メモを保存'}).click();
  await expect(sort).toHaveValue('oldest');
  await expect(headings(page)).toHaveText([
    'API B',
    'API A',
    'API C',
    'API D',
    'API新規',
  ]);
  const saved = (await storage(page)).raw;
  expect(JSON.parse(saved!)[4]).toMatchObject({
    createdAt: loadedAt,
    createdAtEstimated: false,
    status: '完了',
    priority: '低',
    memo: '保存メモ',
  });
  await page.reload();
  await expect(sort).toHaveValue('newest');
  await expect(headings(page)).toHaveText([
    'API新規',
    'API D',
    'API A',
    'API C',
    'API B',
  ]);
  await expect(added).toContainText('登録日時：2026/11/18 10:02:03');
  expect((await storage(page)).raw).toBe(saved);
});

test('欠落と不正日時だけを共通時刻で保存し補完済み日時を再保存しない', async ({
  page,
}) => {
  const items = [
    dated[0],
    {...dated[1], createdAtEstimated: true},
    {id: 'legacy', title: '旧データ', ...base},
    {id: 'invalid', title: '不正日時', ...base, createdAt: null},
    {
      id: 'flagless',
      title: 'フラグなし',
      ...base,
      createdAt: dated[0].createdAt,
    },
  ];
  await seed(page, items);
  await expect(page.getByRole('article')).toHaveCount(5);
  const first = await storage(page);
  expect(first.writes).toBe('1');
  expect(JSON.parse(first.raw!)).toEqual([
    items[0],
    items[1],
    {...items[2], createdAt: loadedAt, createdAtEstimated: true},
    {...items[3], createdAt: loadedAt, createdAtEstimated: true},
    {...items[4], createdAtEstimated: false},
  ]);
  await expect(card(page, '旧データ')).toContainText(
    '登録日時（補完）：2026/11/18 10:02:03',
  );
  await expect(card(page, '不正日時')).toContainText(
    '登録日時（補完）：2026/11/18 10:02:03',
  );
  await page.clock.setFixedTime(new Date('2027-01-01T00:00:00.000Z'));
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(5);
  expect(await storage(page)).toEqual(first);
  await expect(card(page, '旧データ')).toContainText(
    '登録日時（補完）：2026/11/18 10:02:03',
  );
});

test('補完保存失敗は元データを守り全操作を停止し再読み込み時刻で復旧する', async ({
  page,
}) => {
  await seed(page, []);
  const original = JSON.stringify([
    {id: 'legacy', title: '既存', ...base},
    dated[0],
  ]);
  await page.evaluate(
    ({key, original}) => {
      localStorage.setItem(key, original);
      sessionStorage.setItem('fail-save', 'true');
    },
    {key: STORAGE_KEY, original},
  );
  await page.reload();
  await expect(page.getByRole('alert')).toContainText(
    '登録日時の補完データを保存できませんでした',
  );
  for (const selector of [
    '#title',
    '#content',
    '#filter',
    '#priority-filter',
    '#search',
    '#sort-order',
    'button[type="submit"]',
  ]) {
    await expect(page.locator(selector)).toBeDisabled();
  }
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.locator('#notice')).toBeEmpty();
  await page.evaluate(() => {
    document
      .querySelector('form')!
      .dispatchEvent(new Event('submit', {cancelable: true}));
  });
  expect((await storage(page)).raw).toBe(original);
  await page.evaluate(() => sessionStorage.setItem('fail-save', 'false'));
  await page.clock.setFixedTime(new Date('2027-01-02T03:04:05.678Z'));
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(
    page.getByRole('button', {name: '登録する', exact: true}),
  ).toBeEnabled();
  const saved = JSON.parse((await storage(page)).raw!);
  expect(saved).toEqual([
    {
      id: 'legacy',
      title: '既存',
      ...base,
      createdAt: '2027-01-02T03:04:05.678Z',
      createdAtEstimated: true,
    },
    dated[0],
  ]);
});

test('初回サンプル3件は共通補完日時を保存し空配列は保存も再投入もしない', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(loadedAt));
  await page.goto('/');
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(
    page.getByText('登録日時（補完）：2026/11/18 10:02:03', {exact: true}),
  ).toHaveCount(3);
  const first = (await storage(page)).raw;
  expect(
    JSON.parse(first!).map(
      (item: {createdAt: string; createdAtEstimated: boolean}) => [
        item.createdAt,
        item.createdAtEstimated,
      ],
    ),
  ).toEqual([
    [loadedAt, true],
    [loadedAt, true],
    [loadedAt, true],
  ]);
  await page.clock.setFixedTime(new Date('2027-01-01T00:00:00.000Z'));
  await page.reload();
  await expect(
    page.getByText('登録日時（補完）：2026/11/18 10:02:03', {exact: true}),
  ).toHaveCount(3);
  expect((await storage(page)).raw).toBe(first);
  await page.evaluate(key => localStorage.setItem(key, '[]'), STORAGE_KEY);
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'jcbc-demo.inquiries.v1') {
        sessionStorage.setItem('empty-saved', 'true');
      }
      setItem.call(this, key, value);
    };
  });
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(0);
  expect((await storage(page)).raw).toBe('[]');
  expect(
    await page.evaluate(() => sessionStorage.getItem('empty-saved')),
  ).toBeNull();
});

for (const timezoneId of ['UTC', 'America/Los_Angeles']) {
  test(`端末${timezoneId}でも通常・補完日時をJSTで表示する`, async ({
    browser,
  }) => {
    const context = await browser.newContext({timezoneId});
    const page = await context.newPage();
    await seed(page, [
      {...dated[0], createdAt: '2024-02-29T15:00:00.000Z'},
      {
        ...dated[1],
        createdAt: '2026-01-02T18:04:05.999Z',
        createdAtEstimated: true,
      },
    ]);
    await expect(card(page, 'API A')).toContainText(
      '登録日時：2024/03/01 00:00:00',
    );
    await expect(card(page, 'API B')).toContainText(
      '登録日時（補完）：2026/01/03 03:04:05',
    );
    await context.close();
  });
}
