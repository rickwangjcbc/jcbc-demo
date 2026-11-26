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
  memo: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  createdAtEstimated: false,
}));
const savedJson = JSON.stringify(saved);

async function seed(
  page: Page,
  raw: string | null = savedJson,
  failSave = false,
): Promise<void> {
  await page.addInitScript(
    ({key, raw, failSave}) => {
      if (raw !== null) {
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

async function expectCount(
  page: Page,
  visible: number,
  total: number,
): Promise<void> {
  const count = page.locator('#count');
  await expect(count).toBeVisible();
  await expect(count).toHaveText(`表示：${visible}件 / 全${total}件`);
  await expect(page.getByRole('article')).toHaveCount(visible);
}

async function expectCountUnavailable(
  page: Page,
  message: string,
): Promise<void> {
  const error = page.getByRole('alert');
  await expect(error).toBeVisible();
  await expect(error).toContainText(message);
  const count = page.locator('#count');
  await expect(count).toHaveAttribute('hidden', '');
  await expect(count).toBeHidden();
}

async function register(page: Page, title: string): Promise<void> {
  await page.getByLabel('件名（必須・100文字以内）').fill(title);
  await page
    .getByLabel('内容（必須・1,000文字以内）')
    .fill('登録する合成データ');
  await page.getByRole('button', {name: '登録する'}).click();
}

test('初期表示から検索・両絞り込みの併用と解除まで一覧件数だけを更新する', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/');
  const summary = page.getByRole('region', {name: '対応状況サマリー'});
  const expectListAndSummary = async (visible: number) => {
    await expectCount(page, visible, 4);
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('listitem')).toHaveText([
      '全件：4件',
      '未対応：1件',
      '対応中：1件',
      '完了：2件',
    ]);
  };
  const search = page.getByLabel('キーワード検索（件名・内容）');
  const status = page.getByLabel('対応状況で絞り込み');
  const priority = page.getByLabel('優先度で絞り込み');

  await expectListAndSummary(4);
  await search.fill('API');
  await expectListAndSummary(3);
  await status.selectOption('完了');
  await expectListAndSummary(1);
  await priority.selectOption('低');
  await expectListAndSummary(0);
  await priority.selectOption('高');
  await expectListAndSummary(1);
  await status.selectOption('未対応');
  await expectListAndSummary(1);
  await search.fill('一致しない');
  await expectListAndSummary(0);
  await expect(
    page.getByText('該当するお問い合わせはありません。'),
  ).toBeVisible();
  await search.fill('');
  await expectListAndSummary(1);
  await status.selectOption('すべて');
  await expectListAndSummary(2);
  await priority.selectOption('すべて');
  await expectListAndSummary(4);
  await page
    .getByRole('button', {name: '優先度の高いお問い合わせを表示'})
    .click();
  await expectListAndSummary(2);
  await page.getByLabel('並び順', {exact: true}).selectOption('oldest');
  await expectListAndSummary(2);
});

test('正常な空データでは表示・総件数ともに0件を案内とともに表示する', async ({
  page,
}) => {
  await seed(page, '[]');
  await page.goto('/');
  await expectCount(page, 0, 0);
  await expect(
    page.getByText('該当するお問い合わせはありません。'),
  ).toBeVisible();
});

test('破損したJSONを読み込むと件数欄を表示しない', async ({page}) => {
  await seed(page, 'broken-json');
  await page.goto('/');
  await expectCountUnavailable(page, '保存データを読み込めません');
});

test('getItemが例外を送出すると件数欄を表示しない', async ({page}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  await page.goto('/');
  await expectCountUnavailable(page, '保存データを読み込めません');
});

for (const [name, raw] of [
  ['初回サンプル', null],
  [
    '登録日時の補完',
    JSON.stringify([
      {id: 'legacy', title: '旧データ', content: '合成本文', status: '未対応'},
    ]),
  ],
] as const) {
  test(`${name}の保存失敗時は件数欄を表示しない`, async ({page}) => {
    await seed(page, raw, true);
    await page.goto('/');
    await expectCountUnavailable(
      page,
      '登録日時の補完データを保存できませんでした',
    );
  });
}

test('検索中の登録成功は一致時に両件数、不一致時に総件数だけを増やす', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/');
  await page.getByLabel('キーワード検索（件名・内容）').fill('API');
  await register(page, 'API 追加');
  await expectCount(page, 4, 5);
  await expect(page.getByRole('heading', {name: 'API 追加'})).toBeVisible();
  await register(page, '別件の追加');
  await expectCount(page, 4, 6);
  await expect(page.getByRole('heading', {name: '別件の追加'})).toHaveCount(0);
});

const edits = [
  {
    field: '対応状況',
    filter: '対応状況で絞り込み',
    before: '未対応',
    after: '完了',
    remaining: 0,
  },
  {
    field: '優先度',
    filter: '優先度で絞り込み',
    before: '高',
    after: '低',
    remaining: 1,
  },
] as const;

for (const {field, filter, before, after, remaining} of edits) {
  test(`${field}の保存成功で条件から外れたカードと表示件数だけが減る`, async ({
    page,
  }) => {
    await seed(page);
    await page.goto('/');
    await page.getByLabel(filter).selectOption(before);
    await expect(page.getByRole('article')).toHaveCount(remaining + 1);
    await page.getByLabel(`API Aの${field}`).selectOption(after);
    await expectCount(page, remaining, 4);
    await expect(page.getByRole('heading', {name: 'API A'})).toHaveCount(0);
  });
}

test.describe('読み込み後の保存失敗', () => {
  test.beforeEach(async ({page}) => {
    await seed(page);
    await page.goto('/');
    await expect(page.getByRole('article')).toHaveCount(4);
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('Full', 'QuotaExceededError');
      };
    });
  });

  async function expectSaveFailed(page: Page): Promise<void> {
    const error = page.getByRole('alert');
    await expect(error).toBeVisible();
    await expect(error).toContainText('ブラウザに保存できませんでした');
    await expectCount(page, 1, 4);
    await expect(page.getByRole('article').getByRole('heading')).toHaveText(
      'API A',
    );
    expect(
      await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY),
    ).toBe(savedJson);
  }

  test('登録失敗では直前のカードと両件数を維持する', async ({page}) => {
    await page.getByLabel('キーワード検索（件名・内容）').fill('API A');
    await register(page, 'API A の追加');
    await expectSaveFailed(page);
  });

  for (const {field, filter, before, after} of edits) {
    test(`${field}の保存失敗では直前のカードと両件数を維持して選択値を戻す`, async ({
      page,
    }) => {
      await page.getByLabel('キーワード検索（件名・内容）').fill('API A');
      await page.getByLabel(filter).selectOption(before);
      const select = page.getByLabel(`API Aの${field}`);
      await select.selectOption(after);
      await expectSaveFailed(page);
      await expect(select).toHaveValue(before);
    });
  }
});
