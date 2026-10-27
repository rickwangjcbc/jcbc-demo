import {expect, test} from '@playwright/test';

test('初回は合成サンプル3件を表示する', async ({page}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', {name: 'お問い合わせ管理'}),
  ).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(3);
});

test('登録内容と対応状況を再読み込み後も保持する', async ({page}) => {
  await page.goto('/');
  await page
    .getByLabel('件名（必須・100文字以内）')
    .fill('合成デモのお問い合わせ');
  await page
    .getByLabel('内容（必須・1,000文字以内）')
    .fill('これは合成データです。');
  await page.getByRole('button', {name: '登録する'}).click();
  const card = page
    .getByRole('article')
    .filter({hasText: '合成デモのお問い合わせ'});
  await expect(card).toBeVisible();
  await expect(card.getByRole('combobox', {name: /の対応状況$/})).toHaveValue(
    '未対応',
  );
  await card.getByRole('combobox', {name: /の対応状況$/}).selectOption('完了');
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(4);
  await expect(card.getByRole('combobox', {name: /の対応状況$/})).toHaveValue(
    '完了',
  );
  await expect(card).toContainText('これは合成データです。');
});

test('状態で絞り込み、すべてで解除し、空の結果を表示する', async ({page}) => {
  await page.goto('/');
  for (const status of ['未対応', '対応中', '完了']) {
    await page.getByLabel('対応状況で絞り込み').selectOption(status);
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(
      page.getByRole('article').getByRole('combobox', {name: /の対応状況$/}),
    ).toHaveValue(status);
  }
  await page
    .getByRole('article')
    .getByRole('combobox', {name: /の対応状況$/})
    .selectOption('未対応');
  await expect(
    page.getByText('該当するお問い合わせはありません。'),
  ).toBeVisible();
  await page.getByLabel('対応状況で絞り込み').selectOption('すべて');
  await expect(page.getByRole('article')).toHaveCount(3);
});

test('空白と文字数超過を拒否し、上限ちょうどを登録できる', async ({page}) => {
  await page.goto('/');
  const title = page.getByLabel('件名（必須・100文字以内）');
  const content = page.getByLabel('内容（必須・1,000文字以内）');
  const submit = page.getByRole('button', {name: '登録する'});
  for (const [subject, body, reason] of [
    ['　 ', '本文', '件名は必須'],
    ['件名', '　 ', '内容は必須'],
    ['あ'.repeat(101), '本文', '件名は100文字以内'],
    ['件名', 'あ'.repeat(1001), '内容は1000文字以内'],
  ]) {
    await title.fill(subject);
    await content.fill(body);
    await submit.click();
    await expect(page.getByRole('alert')).toContainText(reason);
    await expect(page.getByRole('article')).toHaveCount(3);
  }
  await title.fill('😀'.repeat(100));
  await content.fill('あ'.repeat(1000));
  await submit.click();
  await expect(page.getByRole('article')).toHaveCount(4);
  await expect(page.getByRole('alert')).toBeHidden();
});

test('入力されたHTMLを実行せずテキストとして表示する', async ({page}) => {
  await page.goto('/');
  const payload = '<img src=x onerror="document.title=123">';
  await page.getByLabel('件名（必須・100文字以内）').fill(payload);
  await page
    .getByLabel('内容（必須・1,000文字以内）')
    .fill('<script>alert(1)</script>');
  await page.getByRole('button', {name: '登録する'}).click();
  await expect(
    page.getByRole('article').filter({hasText: payload}),
  ).toBeVisible();
  await expect(page.locator('article img, article script')).toHaveCount(0);
  await expect(page).toHaveTitle('お問い合わせ管理 | JCBC Demo');
});

test('壊れた保存データを上書きせず操作を停止する', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('jcbc-demo.inquiries.v1', 'broken-json');
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText(
    '保存データを読み込めません',
  );
  await expect(page.getByRole('button', {name: '登録する'})).toBeDisabled();
  expect(
    await page.evaluate(() => localStorage.getItem('jcbc-demo.inquiries.v1')),
  ).toBe('broken-json');
});

test('保存容量エラー時に未保存の登録を成功表示しない', async ({page}) => {
  await page.goto('/');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError');
    };
  });
  await page.getByLabel('件名（必須・100文字以内）').fill('保存失敗テスト');
  await page.getByLabel('内容（必須・1,000文字以内）').fill('合成データ');
  await page.getByRole('button', {name: '登録する'}).click();
  await expect(page.getByRole('alert')).toContainText('保存できませんでした');
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(page.getByLabel('件名（必須・100文字以内）')).toHaveValue(
    '保存失敗テスト',
  );
  await page
    .getByRole('article')
    .first()
    .getByRole('combobox', {name: /の対応状況$/})
    .selectOption('完了');
  await expect(
    page
      .getByRole('article')
      .first()
      .getByRole('combobox', {name: /の対応状況$/}),
  ).toHaveValue('未対応');
});

test('ストレージ利用不可の場合は初回操作を停止する', async ({page}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText(
    '保存データを読み込めません',
  );
  await expect(page.getByRole('button', {name: '登録する'})).toBeDisabled();
});
