import {expect, Locator, Page, test} from '@playwright/test';

const originalTitle = 'デモ操作の確認';
const originalContent = '登録方法を教えてください。';
const storageKey = 'jcbc-demo.inquiries.v1';

function button(card: Locator, name: string) {
  return card.getByRole('button', {name, exact: true});
}

function fields(card: Locator) {
  return {
    title: card.getByRole('textbox', {name: '件名', exact: true}),
    content: card.getByRole('textbox', {name: '内容', exact: true}),
  };
}

async function startEdit(card: Locator) {
  await expect(button(card, '編集')).toBeVisible();
  await button(card, '編集').click();
  return fields(card);
}

function savedData(page: Page) {
  return page.evaluate(key => localStorage.getItem(key), storageKey);
}

async function savedRegistrationTime(page: Page, id: string) {
  const items = JSON.parse((await savedData(page))!) as {
    id: string;
    createdAt: string;
    createdAtEstimated: boolean;
  }[];
  const item = items.find(item => item.id === id);
  return (
    item && {
      createdAt: item.createdAt,
      createdAtEstimated: item.createdAtEstimated,
    }
  );
}

test.beforeEach(async ({page}) => {
  await page.goto('/');
});

test('保存済みの値から編集し、明示保存した整形済みの値を再読み込み後も表示する', async ({
  page,
}) => {
  const card = page.getByRole('article').first();
  const saved = await savedData(page);
  const {title, content} = await startEdit(card);
  await expect(title).toHaveValue(originalTitle);
  await expect(content).toHaveValue(originalContent);
  await title.fill('  更新した件名　');
  await content.fill(' \n更新した内容\n補足　');
  expect(await savedData(page)).toBe(saved);
  await button(card, '保存').click();
  await expect(page.locator('#notice')).toContainText('保存しました');
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    await expect(button(card, '編集')).toBeVisible();
    await expect(title).toHaveCount(0);
    expect(await card.getByRole('heading').textContent()).toBe('更新した件名');
    expect(await card.getByText('更新した内容').textContent()).toBe(
      '更新した内容\n補足',
    );
  }
});

test('キャンセルは確認を出さずに対象の入力を破棄する', async ({page}) => {
  const card = page.getByRole('article').first();
  const saved = await savedData(page);
  const {title, content} = await startEdit(card);
  await title.fill('破棄する件名');
  await content.fill('破棄する内容');
  const dialogs: string[] = [];
  page.on('dialog', async dialog => {
    dialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await button(card, 'キャンセル').click();
  expect(dialogs).toEqual([]);
  await expect(card.getByRole('heading')).toHaveText(originalTitle);
  await expect(card.getByText(originalContent, {exact: true})).toBeVisible();
  expect(await savedData(page)).toBe(saved);
  await startEdit(card);
  await expect(title).toHaveValue(originalTitle);
  await expect(content).toHaveValue(originalContent);
});

test('キーボード編集の開始後は操作したカードの件名欄にフォーカスする', async ({
  page,
}) => {
  const card = page.getByRole('article').filter({hasText: '画面表示について'});
  await button(card, '編集').press('Enter');
  await expect(fields(card).title).toBeFocused();
});

for (const action of ['キャンセル', '保存'] as const) {
  test(`キーボード編集の${action}後は残った同じカードの編集ボタンにフォーカスする`, async ({
    page,
  }) => {
    const cards = page.getByRole('article');
    const card = cards.filter({hasText: '画面表示について'});
    const {title} = await startEdit(card);
    await title.fill('更新後の件名');
    await button(card, action).press('Enter');
    const heading = action === '保存' ? '更新後の件名' : '画面表示について';
    const remaining = cards.filter({
      has: page.getByRole('heading', {name: heading, exact: true}),
    });
    await expect(button(remaining, '編集')).toBeFocused();
  });
}

test('キーボード編集の保存で対象カードだけが検索結果から消えた場合は検索欄にフォーカスする', async ({
  page,
}) => {
  const search = page.getByLabel('キーワード検索（件名・内容）');
  await search.fill('確認');
  const cards = page.getByRole('article');
  const card = cards.filter({hasText: '利用手順の確認'});
  const {title, content} = await startEdit(card);
  await title.fill('手順のご案内');
  await content.fill('操作手順を更新しました。');
  await button(card, '保存').press('Enter');
  await expect(cards).toHaveCount(2);
  await expect(card).toHaveCount(0);
  await expect(search).toBeFocused();
});

test('必須とコードポイント上限を生の入力で検証し、不合格なら保存しない', async ({
  page,
}) => {
  const card = page.getByRole('article').first();
  await card.getByLabel('優先度').selectOption('高');
  await expect(page.locator('#notice')).not.toBeEmpty();
  const saved = await savedData(page);
  const {title, content} = await startEdit(card);
  const validTitle = ` ${'😀'.repeat(98)}\u3000`;
  const validContent = `\n${'😀'.repeat(998)}\u3000`;
  const alert = page.getByRole('alert');
  for (const [nextTitle, nextContent, expectedErrors] of [
    ['', '', ['件名は必須', '内容は必須']],
    [' 　', ' \n　', ['件名は必須', '内容は必須']],
    [`${validTitle} `, validContent, ['件名は100文字以内']],
    [validTitle, `${validContent} `, ['内容は1000文字以内']],
  ] as const) {
    await title.fill(nextTitle);
    await content.fill(nextContent);
    const save = button(card, '保存');
    await save.press('Enter');
    await expect(save).toBeFocused();
    for (const message of expectedErrors) {
      await expect(alert).toContainText(message);
    }
    await expect(title).toHaveValue(nextTitle);
    await expect(content).toHaveValue(nextContent);
    await expect(page.locator('#notice')).toBeEmpty();
    expect(await savedData(page)).toBe(saved);
  }
  await title.fill(validTitle);
  await content.fill(validContent);
  await button(card, '保存').click();
  await expect(alert).toBeHidden();
  expect(await card.getByRole('heading').textContent()).toBe('😀'.repeat(98));
  const savedContent = card.getByText('😀'.repeat(998), {exact: true});
  await expect(savedContent).toBeVisible();
  expect(await savedContent.textContent()).toBe('😀'.repeat(998));
});

test('保存が一度失敗しても入力と保存値を維持し、同じ入力で再試行できる', async ({
  page,
}) => {
  const card = page.getByRole('article').first();
  await card.getByLabel('優先度').selectOption('高');
  await expect(page.locator('#notice')).not.toBeEmpty();
  const saved = await savedData(page);
  const {title, content} = await startEdit(card);
  await title.fill('再試行する件名');
  await content.fill('再試行する内容');
  await page.evaluate(key => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage && name === key) {
        Storage.prototype.setItem = setItem;
        throw new DOMException('テスト用の容量不足', 'QuotaExceededError');
      }
      setItem.call(this, name, value);
    };
  }, storageKey);
  const save = button(card, '保存');
  await save.press('Enter');
  await expect(save).toBeFocused();
  await expect(page.getByRole('alert')).toContainText('保存できませんでした');
  await expect(page.locator('#notice')).toBeEmpty();
  await expect(title).toHaveValue('再試行する件名');
  await expect(content).toHaveValue('再試行する内容');
  expect(await savedData(page)).toBe(saved);

  await page.getByLabel('キーワード検索（件名・内容）').fill(originalTitle);
  await expect(card).toBeVisible();
  await button(card, '保存').click();
  await expect(page.getByRole('alert')).toBeHidden();
  await expect(page.locator('#notice')).toContainText('保存しました');
  await page.reload();
  await expect(card.getByRole('heading')).toHaveText('再試行する件名');
  await expect(card.getByText('再試行する内容', {exact: true})).toBeVisible();
});

for (const action of ['保存', 'キャンセル']) {
  test(`一方のカードの${action}は他方の下書きや保存値を変えない`, async ({
    page,
  }) => {
    const cards = page.getByRole('article');
    const first = cards.nth(0);
    const second = cards.nth(1);
    const firstFields = await startEdit(first);
    const secondFields = await startEdit(second);
    await firstFields.title.fill('一件目の変更');
    await firstFields.content.fill('一件目の本文');
    await secondFields.title.fill('二件目の下書き');
    await secondFields.content.fill('二件目の本文');
    await button(first, action).click();
    const expected = action === '保存' ? '一件目の変更' : originalTitle;
    await expect(first.getByRole('heading')).toHaveText(expected);
    await expect(secondFields.title).toHaveValue('二件目の下書き');
    await expect(secondFields.content).toHaveValue('二件目の本文');
    await page.reload();
    await expect(first.getByRole('heading')).toHaveText(expected);
    await expect(second.getByRole('heading')).toHaveText('画面表示について');
    await expect(
      second.getByText('一覧の見方を確認したいです。'),
    ).toBeVisible();
  });
}

test('検索と各絞り込みの解除で下書きを復元し、下書きだけの語は検索に使わない', async ({
  page,
}) => {
  const card = page.getByRole('article').filter({
    has: page.getByLabel(`${originalTitle}の対応状況`, {exact: true}),
  });
  const {title, content} = await startEdit(card);
  await title.fill(' 件名下書き限定語 ');
  await content.fill(' 本文下書き限定語\n');
  const search = page.getByLabel('キーワード検索（件名・内容）');
  for (const keyword of ['件名下書き限定語', '本文下書き限定語']) {
    await search.fill(keyword);
    await expect(page.getByRole('article')).toHaveCount(0);
    await search.fill(originalTitle);
    await expect(search).toBeFocused();
    await expect(title).toHaveValue(' 件名下書き限定語 ');
    await expect(content).toHaveValue(' 本文下書き限定語\n');
  }
  for (const [label, selection] of [
    ['対応状況で絞り込み', '完了'],
    ['優先度で絞り込み', '高'],
  ]) {
    const filter = page.getByLabel(label);
    await filter.selectOption(selection);
    await expect(card).toHaveCount(0);
    await filter.selectOption('すべて');
    await expect(title).toHaveValue(' 件名下書き限定語 ');
    await expect(content).toHaveValue(' 本文下書き限定語\n');
  }
});

for (const transition of ['再読み込み', 'ページを閉じて開き直す'] as const) {
  test(`${transition}と未保存の入力は残らない`, async ({context, page}) => {
    const {title, content} = await startEdit(page.getByRole('article').first());
    await title.fill('未保存の件名');
    await content.fill('未保存の内容');
    let reopened = page;
    if (transition === '再読み込み') {
      await page.reload();
    } else {
      await page.close();
      reopened = await context.newPage();
      await reopened.goto('/');
    }
    const card = reopened.getByRole('article').first();
    await expect(card.getByRole('heading')).toHaveText(originalTitle);
    await expect(card.getByText(originalContent, {exact: true})).toBeVisible();
    await expect(button(card, '編集')).toBeVisible();
    await expect(fields(card).title).toHaveCount(0);
  });
}

test('保存後に検索を再評価し、条件と全件集計は維持して表示件数を更新する', async ({
  page,
}) => {
  const search = page.getByLabel('キーワード検索（件名・内容）');
  const status = page.getByLabel('対応状況で絞り込み');
  const priority = page.getByLabel('優先度で絞り込み');
  const sort = page.getByLabel('並び順');
  const count = page.locator('#count');
  const summary = page.locator('#status-summary');
  await search.fill('登録方法');
  await status.selectOption('未対応');
  await priority.selectOption('中');
  await sort.selectOption('oldest');
  await expect(count).toHaveText('表示：1件 / 全3件');
  const previousSummary = await summary.innerText();
  const card = page.getByRole('article');
  const {title, content} = await startEdit(card);
  await title.fill('変更後の件名');
  await content.fill('変更後の本文');
  await button(card, '保存').click();
  await expect(card).toHaveCount(0);
  await expect(count).toHaveText('表示：0件 / 全3件');
  await expect(search).toHaveValue('登録方法');
  await expect(status).toHaveValue('未対応');
  await expect(priority).toHaveValue('中');
  await expect(sort).toHaveValue('oldest');
  expect(await summary.innerText()).toBe(previousSummary);
  await expect(page.locator('#notice')).toContainText('保存しました');
  for (const keyword of ['変更後の件名', '変更後の本文']) {
    await search.fill(keyword);
    await expect(card.getByRole('heading')).toHaveText('変更後の件名');
    await expect(count).toHaveText('表示：1件 / 全3件');
  }
});

test('編集中に別途保存した他項目と元の登録日時を上書きしない', async ({
  page,
}) => {
  const card = page.getByRole('article').first();
  await expect(card.getByRole('heading')).toHaveText(originalTitle);
  const timestamp = await card.getByText(/^登録日時（補完）：/).innerText();
  const id = 'sample-1';
  const memo = card.getByLabel('対応メモ');
  const {title, content} = await startEdit(card);
  await title.fill('修正後の件名');
  await content.fill('修正後の本文');
  await card.getByLabel('対応状況').selectOption('完了');
  await card.getByLabel('優先度').selectOption('高');
  await memo.fill('先に保存したメモ');
  await button(card, 'メモを保存').click();
  await memo.fill('未保存のメモ');
  const beforeSave = await savedRegistrationTime(page, id);
  expect(beforeSave).toStrictEqual({
    createdAt: expect.stringMatching(/\S/),
    createdAtEstimated: true,
  });
  await button(card, '保存').click();
  expect(await savedRegistrationTime(page, id)).toStrictEqual(beforeSave);
  await expect(memo).toHaveValue('未保存のメモ');
  await page.reload();
  await expect(card.getByRole('heading')).toHaveText('修正後の件名');
  await expect(card.getByText('修正後の本文', {exact: true})).toBeVisible();
  await expect(card.getByLabel('対応状況')).toHaveValue('完了');
  await expect(card.getByLabel('優先度')).toHaveValue('高');
  await expect(memo).toHaveValue('先に保存したメモ');
  await expect(card.getByText(timestamp, {exact: true})).toBeVisible();
});
