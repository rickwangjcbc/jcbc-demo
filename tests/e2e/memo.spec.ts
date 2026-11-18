import {expect, test} from '@playwright/test';

test('メモを明示保存して書式を復元し、空欄保存でメモだけ削除する', async ({
  page,
}) => {
  await page.goto('/');
  const card = page.getByRole('article').first();
  const memo = card.getByLabel('対応メモ');
  const save = card.getByRole('button', {name: 'メモを保存'});
  const formatted = ' \n　対応内容\n次の作業　\n ';
  await expect(memo).toHaveValue('');
  await memo.fill(formatted);
  await page.reload();
  await expect(memo).toHaveValue('');
  await memo.fill(formatted);
  await save.click();
  await expect(page.locator('#notice')).toHaveText('メモを保存しました！！');
  await page.reload();
  await expect(memo).toHaveValue(formatted);
  for (const blank of ['', ' \n　\t']) {
    await memo.fill('削除対象');
    await save.click();
    await memo.fill(blank);
    await save.click();
    await expect(memo).toHaveValue('');
    await page.reload();
    await expect(memo).toHaveValue('');
    await expect(page.getByRole('article')).toHaveCount(3);
    await expect(card).toContainText('デモ操作の確認');
    await expect(card).toContainText('登録方法を教えてください。');
    await expect(card.getByLabel('対応状況')).toHaveValue('未対応');
    await expect(card.getByLabel('優先度')).toHaveValue('中');
  }
});

test('1000コードポイントを保存し超過時は入力と保存済みデータを維持する', async ({
  page,
}) => {
  await page.goto('/');
  const card = page.getByRole('article').first();
  const memo = card.getByLabel('対応メモ');
  const save = card.getByRole('button', {name: 'メモを保存'});
  const boundary = '😀'.repeat(1000);
  await memo.fill(boundary);
  await save.click();
  await page.reload();
  await expect(memo).toHaveValue(boundary);
  const saved = await page.evaluate(() =>
    localStorage.getItem('jcbc-demo.inquiries.v1'),
  );
  for (const invalid of [
    '😀'.repeat(1001),
    ` ${'あ'.repeat(999)}\n`,
    ' '.repeat(1001),
  ]) {
    await memo.fill(invalid);
    await save.click();
    await expect(page.getByRole('alert')).toContainText('1000文字以内');
    await expect(memo).toHaveValue(invalid);
    await expect(page.locator('#notice')).toBeEmpty();
    expect(
      await page.evaluate(() => localStorage.getItem('jcbc-demo.inquiries.v1')),
    ).toBe(saved);
  }
  await page.reload();
  await expect(memo).toHaveValue(boundary);
});

test('ID別の未保存入力を検索・各絞り込み・状態変更・登録後も保持する', async ({
  page,
}) => {
  await page.goto('/');
  const first = page.getByRole('article').filter({hasText: 'デモ操作の確認'});
  const second = page
    .getByRole('article')
    .filter({hasText: '画面表示について'});
  await first.getByLabel('対応メモ').fill('保存済み');
  await first.getByRole('button', {name: 'メモを保存'}).click();
  const saved = await page.evaluate(() =>
    localStorage.getItem('jcbc-demo.inquiries.v1'),
  );
  await first.getByLabel('対応メモ').fill('未保存メモ限定語');
  await second.getByLabel('対応メモ').fill('別IDの未保存');
  const search = page.getByLabel('キーワード検索（件名・内容）');
  for (const keyword of ['未保存メモ限定語', '保存済み']) {
    await search.fill(keyword);
    await expect(page.getByRole('article')).toHaveCount(0);
  }
  await search.fill('');
  for (const label of ['対応状況で絞り込み', '優先度で絞り込み']) {
    await page
      .getByLabel(label)
      .selectOption(label.startsWith('対応') ? '完了' : '高');
    await expect(first).toHaveCount(0);
    await page.getByLabel(label).selectOption('すべて');
    await expect(first.getByLabel('対応メモ')).toHaveValue('未保存メモ限定語');
    await expect(second.getByLabel('対応メモ')).toHaveValue('別IDの未保存');
  }
  expect(
    await page.evaluate(() => localStorage.getItem('jcbc-demo.inquiries.v1')),
  ).toBe(saved);
  await first.getByLabel('対応状況').selectOption('完了');
  await first.getByLabel('優先度').selectOption('高');
  await second.getByRole('button', {name: 'メモを保存'}).click();
  await page.getByLabel('件名（必須・100文字以内）').fill('追加登録');
  await page.getByLabel('内容（必須・1,000文字以内）').fill('合成内容');
  await page.getByRole('button', {name: '登録する'}).click();
  await expect(first.getByLabel('対応メモ')).toHaveValue('未保存メモ限定語');
  await page.reload();
  await expect(first.getByLabel('対応メモ')).toHaveValue('保存済み');
  await expect(second.getByLabel('対応メモ')).toHaveValue('別IDの未保存');
  await expect(first.getByLabel('対応状況')).toHaveValue('完了');
  await expect(first.getByLabel('優先度')).toHaveValue('高');
  await expect(page.getByRole('article')).toHaveCount(4);
});

test('保存失敗時は入力と保存済みデータを維持し成功表示せず再試行できる', async ({
  page,
}) => {
  await page.goto('/');
  const card = page.getByRole('article').first();
  const memo = card.getByLabel('対応メモ');
  const save = card.getByRole('button', {name: 'メモを保存'});
  await memo.fill('直前の保存済み');
  await save.click();
  const saved = await page.evaluate(() =>
    localStorage.getItem('jcbc-demo.inquiries.v1'),
  );
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      Storage.prototype.setItem = setItem;
      throw new DOMException(
        `Full: ${key}, ${value.length}`,
        'QuotaExceededError',
      );
    };
  });
  await memo.fill('未保存の変更');
  await save.click();
  await expect(page.getByRole('alert')).toContainText('保存できませんでした');
  await expect(memo).toHaveValue('未保存の変更');
  await expect(page.locator('#notice')).toBeEmpty();
  expect(
    await page.evaluate(() => localStorage.getItem('jcbc-demo.inquiries.v1')),
  ).toBe(saved);
  await card.getByLabel('対応状況').selectOption('対応中');
  await expect(memo).toHaveValue('未保存の変更');
  await page.reload();
  await expect(memo).toHaveValue('直前の保存済み');
  await memo.fill('再試行');
  await save.click();
  await expect(page.getByRole('alert')).toBeHidden();
  await expect(page.locator('#notice')).toHaveText('メモを保存しました！！');
  await page.reload();
  await expect(memo).toHaveValue('再試行');
});

test('メモなしの既存データを保持してメモを安全なテキストとして保存する', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('jcbc-demo.inquiries.v1') === null) {
      localStorage.setItem(
        'jcbc-demo.inquiries.v1',
        JSON.stringify([
          {
            id: 'legacy',
            title: '既存件名',
            content: '既存内容',
            status: '対応中',
            priority: '低',
          },
        ]),
      );
    }
  });
  await page.goto('/');
  const card = page.getByRole('article');
  const memo = card.getByLabel('対応メモ');
  await expect(memo).toHaveValue('');
  const payload = '</textarea><img src=x onerror="document.title=123">';
  await memo.fill(payload);
  await card.getByRole('button', {name: 'メモを保存'}).click();
  await page.reload();
  await expect(memo).toHaveValue(payload);
  await expect(card).toContainText('既存件名');
  await expect(card).toContainText('既存内容');
  await expect(card.getByLabel('対応状況')).toHaveValue('対応中');
  await expect(card.getByLabel('優先度')).toHaveValue('低');
  await expect(page.locator('article img, article script')).toHaveCount(0);
  await expect(page).toHaveTitle('お問い合わせ管理 | JCBC Demo');
});
