import {expect, Page, test} from '@playwright/test';

const STORAGE_KEY = 'jcbc-demo.inquiries.v1';
const saved = [
  {id: 'a', title: 'API A', status: '未対応', priority: '高'},
  {id: 'b', title: 'API B', status: '対応中', priority: '中'},
  {id: 'c', title: 'その他', status: '完了', priority: '低'},
  {id: 'd', title: 'API D', status: '完了', priority: '高'},
].map(item => ({
  ...item,
  content: '合成データ',
  memo: '保存済みメモ',
  createdAt: '2026-01-01T00:00:00.000Z',
  createdAtEstimated: false,
}));

async function seed(
  page: Page,
  raw: string | null,
  failSave = false,
): Promise<void> {
  await page.addInitScript(
    ({key, raw, failSave}) => {
      if (raw !== null && localStorage.getItem(key) === null) {
        localStorage.setItem(key, raw);
      }
      if (failSave) {
        Storage.prototype.setItem = () => {
          throw new DOMException('Full', 'QuotaExceededError');
        };
      }
    },
    {key: STORAGE_KEY, raw, failSave},
  );
}

async function storage(page: Page): Promise<string | null> {
  return page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
}

async function expectSummary(page: Page, counts: number[]): Promise<void> {
  const summary = page.getByRole('region', {name: '対応状況サマリー'});
  await expect(summary).toBeVisible();
  await expect(summary.getByRole('listitem')).toHaveText([
    `全件：${counts[0]}件`,
    `未対応：${counts[1]}件`,
    `対応中：${counts[2]}件`,
    `完了：${counts[3]}件`,
  ]);
}

async function failSaves(page: Page): Promise<void> {
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError');
    };
  });
}

test('一覧見出し直後・検索前に初回サンプル全体の4項目を表示する', async ({
  page,
}) => {
  await page.goto('/');
  await expectSummary(page, [3, 1, 1, 1]);
  await expect(
    page.getByRole('heading', {name: '対応状況サマリー', level: 3}),
  ).toBeVisible();
  await expect(page.locator('#list-heading + #status-summary')).toBeVisible();
  await expect(
    page.locator('#status-summary + label[for="search"] + #search'),
  ).toBeVisible();
  await expect(page.locator('#count')).toHaveText('全3件');
  const items = JSON.parse((await storage(page))!);
  expect(items).toHaveLength(3);
  expect(items.map((item: {status: string}) => item.status)).toEqual([
    '未対応',
    '対応中',
    '完了',
  ]);
});

test('登録保存成功直後に全件と未対応だけを更新し再読み込み後も一致する', async ({
  page,
}) => {
  await seed(page, JSON.stringify(saved));
  await page.goto('/');
  await expectSummary(page, [4, 1, 1, 2]);
  await page.getByLabel('件名（必須・100文字以内）').fill('追加の合成データ');
  await page.getByLabel('内容（必須・1,000文字以内）').fill('登録内容');
  await expectSummary(page, [4, 1, 1, 2]);
  await page.getByRole('button', {name: '登録する'}).click();
  await expect(page.locator('#notice')).toHaveText(
    'お問い合わせを登録しました。',
  );
  await expectSummary(page, [5, 2, 1, 2]);
  const items = JSON.parse((await storage(page))!);
  expect(items).toHaveLength(5);
  expect(items.slice(0, 4)).toEqual(saved);
  expect(items[4]).toMatchObject({title: '追加の合成データ', status: '未対応'});
  await page.reload();
  await expectSummary(page, [5, 2, 1, 2]);
});

test('状況の循環変更と絞り込み中にカードが消える変更でも全体内訳を更新する', async ({
  page,
}) => {
  await seed(page, JSON.stringify(saved));
  await page.goto('/');
  const status = page.getByLabel('API Aの対応状況');
  for (const [value, counts] of [
    ['対応中', [4, 0, 2, 2]],
    ['完了', [4, 0, 1, 3]],
    ['未対応', [4, 1, 1, 2]],
  ] as const) {
    await status.selectOption(value);
    await expectSummary(page, [...counts]);
    expect(JSON.parse((await storage(page))!)[0].status).toBe(value);
  }
  await page.getByLabel('対応状況で絞り込み').selectOption('未対応');
  await expect(page.getByRole('article')).toHaveCount(1);
  await status.selectOption('完了');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expectSummary(page, [4, 0, 1, 3]);
  await page.reload();
  await expectSummary(page, [4, 0, 1, 3]);
});

test('検索・各絞り込み・併用・該当なし・並び順は全体集計と保存を変えない', async ({
  page,
}) => {
  const raw = JSON.stringify(saved);
  await seed(page, raw);
  await page.goto('/');
  await expectSummary(page, [4, 1, 1, 2]);
  await failSaves(page);
  const search = page.getByLabel('キーワード検索（件名・内容）');
  const status = page.getByLabel('対応状況で絞り込み');
  const priority = page.getByLabel('優先度で絞り込み');
  for (const [label, value, count] of [
    [search, 'API', 3],
    [status, '完了', 1],
    [priority, '高', 1],
    [search, '一致しない', 0],
    [search, '', 1],
    [status, 'すべて', 2],
    [priority, '低', 1],
    [priority, 'すべて', 4],
  ] as const) {
    if (label === search) {
      await label.fill(value);
    } else {
      await label.selectOption(value);
    }
    await expect(page.getByRole('article')).toHaveCount(count);
    await expectSummary(page, [4, 1, 1, 2]);
  }
  for (const order of ['oldest', 'newest']) {
    await page.getByLabel('並び順', {exact: true}).selectOption(order);
    await expectSummary(page, [4, 1, 1, 2]);
  }
  expect(await storage(page)).toBe(raw);
  await expect(page.getByRole('alert')).toBeHidden();
});

test('優先度・メモ保存は件数を変えず検索・絞り込み・状況変更でも下書きを守る', async ({
  page,
}) => {
  await seed(page, JSON.stringify(saved));
  await page.goto('/');
  const memo = page.getByLabel('API Aの対応メモ');
  await memo.fill('未保存のメモ');
  await expectSummary(page, [4, 1, 1, 2]);
  await page.getByLabel('キーワード検索（件名・内容）').fill('その他');
  await page.getByLabel('キーワード検索（件名・内容）').fill('');
  await page.getByLabel('対応状況で絞り込み').selectOption('完了');
  await page.getByLabel('対応状況で絞り込み').selectOption('すべて');
  await page.getByLabel('優先度で絞り込み').selectOption('低');
  await page.getByLabel('優先度で絞り込み').selectOption('すべて');
  await expect(memo).toHaveValue('未保存のメモ');
  await page.getByLabel('API Aの優先度').selectOption('低');
  await expectSummary(page, [4, 1, 1, 2]);
  await expect(memo).toHaveValue('未保存のメモ');
  expect(JSON.parse((await storage(page))!)[0].memo).toBe('保存済みメモ');
  await page.getByLabel('API Aの対応状況').selectOption('対応中');
  await expectSummary(page, [4, 0, 2, 2]);
  await expect(memo).toHaveValue('未保存のメモ');
  await page
    .getByRole('article')
    .filter({has: page.getByRole('heading', {name: 'API A', exact: true})})
    .getByRole('button', {name: 'メモを保存'})
    .click();
  await expectSummary(page, [4, 0, 2, 2]);
  expect(JSON.parse((await storage(page))!)[0]).toMatchObject({
    memo: '未保存のメモ',
    priority: '低',
    status: '対応中',
    createdAt: saved[0].createdAt,
    createdAtEstimated: false,
  });
});

test('登録と状況変更の保存失敗は成功表示せず直前の件数と保存・入力を維持する', async ({
  page,
}) => {
  const raw = JSON.stringify(saved);
  await seed(page, raw);
  await page.goto('/');
  await expectSummary(page, [4, 1, 1, 2]);
  await failSaves(page);
  await page.getByLabel('件名（必須・100文字以内）').fill('保存できない件名');
  await page.getByLabel('内容（必須・1,000文字以内）').fill('保存できない内容');
  await page.getByRole('button', {name: '登録する'}).click();
  await expect(page.getByRole('alert')).toContainText('保存できませんでした');
  await expect(page.locator('#notice')).toBeEmpty();
  await expectSummary(page, [4, 1, 1, 2]);
  expect(await storage(page)).toBe(raw);
  await expect(page.getByLabel('件名（必須・100文字以内）')).toHaveValue(
    '保存できない件名',
  );
  await expect(page.getByLabel('内容（必須・1,000文字以内）')).toHaveValue(
    '保存できない内容',
  );
  await page.getByLabel('API Aの対応状況').selectOption('完了');
  await expect(page.getByRole('alert')).toContainText('保存できませんでした');
  await expect(page.locator('#notice')).toBeEmpty();
  await expect(page.getByLabel('API Aの対応状況')).toHaveValue('未対応');
  await expectSummary(page, [4, 1, 1, 2]);
  expect(await storage(page)).toBe(raw);
  await page.getByLabel('キーワード検索（件名・内容）').fill('一致しない');
  await expectSummary(page, [4, 1, 1, 2]);
});

test('保存済み空配列は全0件を表示し再投入・保存しない', async ({page}) => {
  await seed(page, '[]', true);
  await page.goto('/');
  await expectSummary(page, [0, 0, 0, 0]);
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('alert')).toBeHidden();
  expect(await storage(page)).toBe('[]');
});

for (const [name, raw] of [
  ['JSON破損', 'broken-json'],
  ['不正な対応状況', JSON.stringify([{...saved[0], status: 'unknown'}])],
]) {
  test(`${name}はサマリーを非表示にして読み込みエラーと元データを守る`, async ({
    page,
  }) => {
    await seed(page, raw);
    await page.goto('/');
    await expect(page.locator('#status-summary')).toBeHidden();
    await expect(page.getByRole('alert')).toContainText(
      '保存データを読み込めません',
    );
    await expect(page.getByRole('article')).toHaveCount(0);
    await expect(page.getByRole('button', {name: '登録する'})).toBeDisabled();
    expect(await storage(page)).toBe(raw);
  });
}

test('getItem例外時は0件と表示せず読み込みエラーで操作停止する', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  await page.goto('/');
  await expect(page.locator('#status-summary')).toBeHidden();
  await expect(page.getByRole('alert')).toContainText(
    '保存データを読み込めません',
  );
  await expect(page.getByRole('button', {name: '登録する'})).toBeDisabled();
});

for (const initial of ['初回サンプル', '日時補完']) {
  test(`${initial}の保存失敗ではサマリーを表示せず操作を停止する`, async ({
    page,
  }) => {
    const raw = JSON.stringify([
      {id: 'legacy', title: '旧データ', content: '合成本文', status: '未対応'},
    ]);
    await seed(page, initial === '日時補完' ? raw : null, true);
    await page.goto('/');
    await expect(page.locator('#status-summary')).toBeHidden();
    await expect(page.getByRole('alert')).toContainText(
      '登録日時の補完データを保存できませんでした',
    );
    await expect(page.getByRole('article')).toHaveCount(0);
    await expect(page.getByRole('button', {name: '登録する'})).toBeDisabled();
    expect(await storage(page)).toBe(initial === '日時補完' ? raw : null);
  });
}
