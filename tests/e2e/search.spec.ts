import {expect, test} from '@playwright/test';

test('入力ごとに件名・内容を検索し、非一致の案内と検索解除を表示する', async ({
  page,
}) => {
  await page.goto('/');
  const search = page.getByLabel('キーワード検索（件名・内容）');
  await search.fill('表示');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('画面表示について');
  await search.fill('見方');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('画面表示について');
  await search.fill('一致しないキーワード');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(
    page.getByText('該当するお問い合わせはありません。'),
  ).toBeVisible();
  await search.fill('');
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(
    page.getByText('該当するお問い合わせはありません。'),
  ).toHaveCount(0);
});

test('検索と状態を併用し、検索解除でも状態フィルターを維持する', async ({
  page,
}) => {
  await page.goto('/');
  const search = page.getByLabel('キーワード検索（件名・内容）');
  const filter = page.getByLabel('対応状況で絞り込み');
  await search.fill('表示');
  await filter.selectOption('完了');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(
    page.getByText('該当するお問い合わせはありません。'),
  ).toBeVisible();
  await search.fill('');
  await expect(filter).toHaveValue('完了');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('利用手順の確認');
  await search.fill('確認');
  await filter.selectOption('すべて');
  await expect(search).toHaveValue('確認');
  await expect(page.getByRole('article')).toHaveCount(3);
});

test('英字の大小を区別せず検索し、検索中も登録・状態変更・保存を維持する', async ({
  page,
}) => {
  await page.goto('/');
  const search = page.getByLabel('キーワード検索（件名・内容）');
  const filter = page.getByLabel('対応状況で絞り込み');
  await search.fill('api');
  await filter.selectOption('未対応');
  await page.getByLabel('件名（必須・100文字以内）').fill('Demo API setup');
  await page.getByLabel('内容（必須・1,000文字以内）').fill('合成データ');
  await page.getByRole('button', {name: '登録する'}).click();
  await expect(search).toHaveValue('api');
  await expect(filter).toHaveValue('未対応');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('Demo API setup');
  await page.getByLabel('件名（必須・100文字以内）').fill('別の合成データ');
  await page.getByLabel('内容（必須・1,000文字以内）').fill('Use Api here');
  await page.getByRole('button', {name: '登録する'}).click();
  await search.fill('ApI');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByLabel('Demo API setupの対応状況').selectOption('完了');
  await expect(page.getByRole('article')).toHaveCount(1);
  await filter.selectOption('完了');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('Demo API setup');
  const saved = await page.evaluate(() =>
    localStorage.getItem('jcbc-demo.inquiries.v1'),
  );
  await search.fill('存在しない');
  await filter.selectOption('すべて');
  expect(
    await page.evaluate(() => localStorage.getItem('jcbc-demo.inquiries.v1')),
  ).toBe(saved);
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(5);
  await search.fill('API');
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByLabel('Demo API setupの対応状況')).toHaveValue('完了');
});

test('保存データが壊れている場合は検索も停止し上書きしない', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('jcbc-demo.inquiries.v1', 'broken-json');
  });
  await page.goto('/');
  await expect(page.getByLabel('キーワード検索（件名・内容）')).toBeDisabled();
  expect(
    await page.evaluate(() => localStorage.getItem('jcbc-demo.inquiries.v1')),
  ).toBe('broken-json');
});
