import {expect, test} from '@playwright/test';

test('既存データを中で表示し、読み込みや絞り込みでは保存内容を変更しない', async ({
  page,
}) => {
  await page.goto('/');
  const legacy = [
    {id: 'legacy', title: '既存の件名', content: '既存の本文', status: '完了'},
  ];
  await page.evaluate(
    items =>
      localStorage.setItem('jcbc-demo.inquiries.v1', JSON.stringify(items)),
    legacy,
  );
  await page.reload();
  await expect(page.getByLabel('既存の件名の優先度')).toHaveValue('中');
  await expect(page.getByLabel('既存の件名の対応状況')).toHaveValue('完了');
  await expect(page.getByRole('article')).toContainText('既存の本文');
  await page.getByLabel('優先度で絞り込み', {exact: true}).selectOption('中');
  await expect(page.getByRole('article')).toHaveCount(1);
  expect(
    await page.evaluate(() => localStorage.getItem('jcbc-demo.inquiries.v1')),
  ).toBe(JSON.stringify(legacy));
  await page.getByLabel('既存の件名の優先度').selectOption('高');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('既存の件名の優先度')).toHaveValue('高');
  await page.getByLabel('既存の件名の対応状況').selectOption('未対応');
  await page.reload();
  await expect(page.getByLabel('既存の件名の優先度')).toHaveValue('高');
  await expect(page.getByLabel('既存の件名の対応状況')).toHaveValue('未対応');
  await expect(page.getByRole('article')).toContainText('既存の本文');
});

test('三条件併用中の保存失敗で優先度と保存データを維持する', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('優先度で絞り込み', {exact: true}).selectOption('中');
  await page.getByLabel('対応状況で絞り込み').selectOption('未対応');
  await page.getByLabel('キーワード検索（件名・内容）').fill('確認');
  const saved = await page.evaluate(() =>
    localStorage.getItem('jcbc-demo.inquiries.v1'),
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError');
    };
  });
  await page.getByLabel('デモ操作の確認の優先度').selectOption('高');
  await expect(page.getByRole('alert')).toContainText('保存できませんでした');
  await expect(page.getByLabel('デモ操作の確認の優先度')).toHaveValue('中');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('status')).toBeEmpty();
  expect(
    await page.evaluate(() => localStorage.getItem('jcbc-demo.inquiries.v1')),
  ).toBe(saved);
});

test('不正な優先度の保存データを上書きせず操作を停止する', async ({page}) => {
  await page.goto('/');
  const raw = JSON.stringify([
    {
      id: 'invalid',
      title: '件名',
      content: '本文',
      status: '完了',
      priority: '緊急',
    },
  ]);
  await page.evaluate(
    value => localStorage.setItem('jcbc-demo.inquiries.v1', value),
    raw,
  );
  await page.reload();
  await expect(page.getByRole('alert')).toContainText(
    '保存データを読み込めません',
  );
  await expect(
    page.getByLabel('優先度で絞り込み', {exact: true}),
  ).toBeDisabled();
  await expect(page.getByRole('button', {name: '登録する'})).toBeDisabled();
  expect(
    await page.evaluate(() => localStorage.getItem('jcbc-demo.inquiries.v1')),
  ).toBe(raw);
});

test('優先度で絞り込み、解除時も検索・対応状況を維持する', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('デモ操作の確認の優先度').selectOption('高');
  await page.getByLabel('利用手順の確認の優先度').selectOption('低');
  const priorityFilter = page.getByLabel('優先度で絞り込み', {exact: true});
  for (const [priority, title] of [
    ['高', 'デモ操作の確認'],
    ['中', '画面表示について'],
    ['低', '利用手順の確認'],
  ]) {
    await priorityFilter.selectOption(priority);
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('article')).toContainText(title);
  }
  await priorityFilter.selectOption('高');
  await page.getByLabel('対応状況で絞り込み').selectOption('完了');
  await page.getByLabel('キーワード検索（件名・内容）').fill('確認');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(
    page.getByText('該当するお問い合わせはありません。'),
  ).toBeVisible();
  await priorityFilter.selectOption('すべて');
  await expect(page.getByLabel('対応状況で絞り込み')).toHaveValue('完了');
  await expect(page.getByLabel('キーワード検索（件名・内容）')).toHaveValue(
    '確認',
  );
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('利用手順の確認');
  await priorityFilter.selectOption('低');
  await page.getByLabel('キーワード検索（件名・内容）').fill('表示');
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('新規登録は中で、一覧から各優先度に変更して再読み込み後も保持する', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('件名（必須・100文字以内）').fill('優先度テスト');
  await page.getByLabel('内容（必須・1,000文字以内）').fill('合成の本文');
  await page.getByRole('button', {name: '登録する'}).click();
  const priority = page.getByLabel('優先度テストの優先度', {exact: true});
  await expect(priority).toHaveValue('中');
  for (const value of ['高', '低', '中']) {
    await priority.selectOption(value);
    await expect(page.getByRole('status')).toHaveText('優先度を保存しました。');
    await page.reload();
    await expect(priority).toHaveValue(value);
    await expect(page.getByLabel('優先度テストの対応状況')).toHaveValue(
      '未対応',
    );
    await expect(
      page.getByRole('article').filter({hasText: '優先度テスト'}),
    ).toContainText('合成の本文');
  }
});
