import {expect, test} from '@playwright/test';

test('初回は合成サンプル3件を表示する', async ({page}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', {name: 'お問い合わせ管理'}),
  ).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(page.getByLabel('優先度で絞り込み')).toHaveValue('すべて');
  await expect(page.getByLabel('並び順')).toHaveValue('newest');
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
  await expect(card.getByLabel('対応状況')).toHaveValue('未対応');
  await expect(card.getByLabel('優先度')).toHaveValue('中');
  await card.getByLabel('対応状況').selectOption('完了');
  await card.getByLabel('優先度').selectOption('高');
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(4);
  await expect(card.getByLabel('対応状況')).toHaveValue('完了');
  await expect(card.getByLabel('優先度')).toHaveValue('高');
  await expect(card).toContainText('これは合成データです。');
});

test('状態で絞り込み、すべてで解除し、空の結果を表示する', async ({page}) => {
  await page.goto('/');
  for (const status of ['未対応', '対応中', '完了']) {
    await page.getByLabel('対応状況で絞り込み').selectOption(status);
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('article').getByLabel('対応状況')).toHaveValue(
      status,
    );
  }
  await page.getByRole('article').getByLabel('対応状況').selectOption('未対応');
  await expect(
    page.getByText('該当するお問い合わせはありません。'),
  ).toBeVisible();
  await page.getByLabel('対応状況で絞り込み').selectOption('すべて');
  await expect(page.getByRole('article')).toHaveCount(3);
});

test('既存データの優先度を中として表示し、優先度フィルターを適用する', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('jcbc-demo.inquiries.v1') === null) {
      localStorage.setItem(
        'jcbc-demo.inquiries.v1',
        JSON.stringify([
          {
            id: 'legacy',
            title: '既存問い合わせ',
            content: '既存内容',
            status: '対応中',
          },
        ]),
      );
    }
  });
  await page.goto('/');
  const card = page.getByRole('article');
  await expect(card.getByLabel('既存問い合わせの優先度')).toHaveValue('中');
  await page.getByLabel('優先度で絞り込み').selectOption('高');
  await expect(
    page.getByText('該当するお問い合わせはありません。'),
  ).toBeVisible();
  await page.getByLabel('優先度で絞り込み').selectOption('中');
  await expect(card).toContainText('既存問い合わせ');
  await page.getByLabel('優先度で絞り込み').selectOption('すべて');
  await card.getByLabel('既存問い合わせの優先度').selectOption('低');
  await page.reload();
  await expect(page.getByRole('article').getByLabel('優先度')).toHaveValue(
    '低',
  );
});

test('高優先度ショートカットは他の条件を維持し、選択欄で解除できる', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const inquiries = [
      ['合成対象・新', '対応中', '高', '2026-01-03T00:00:00.000Z'],
      ['合成対象・中優先度', '対応中', '中', '2026-01-02T00:00:00.000Z'],
      ['合成対象・旧', '対応中', '高', '2026-01-01T00:00:00.000Z'],
      ['合成対象・完了', '完了', '高', '2026-01-04T00:00:00.000Z'],
      ['合成別件', '対応中', '高', '2026-01-05T00:00:00.000Z'],
    ].map(([title, status, priority, createdAt], index) => ({
      id: `shortcut-${index}`,
      title,
      content: '合成データ',
      status,
      priority,
      memo: '',
      createdAt,
      createdAtEstimated: false,
    }));
    localStorage.setItem('jcbc-demo.inquiries.v1', JSON.stringify(inquiries));
  });
  await page.goto('/');
  const search = page.getByLabel('キーワード検索（件名・内容）');
  const status = page.getByLabel('対応状況で絞り込み');
  const priority = page.getByLabel('優先度で絞り込み');
  const sort = page.getByLabel('並び順');
  const shortcut = page.getByRole('button', {
    name: '優先度の高いお問い合わせを表示',
    exact: true,
  });
  const titles = page.getByRole('article').getByRole('heading');
  const allPriorities = ['合成対象・旧', '合成対象・中優先度', '合成対象・新'];

  await search.fill('合成対象');
  await status.selectOption('対応中');
  await sort.selectOption('oldest');
  await expect(titles).toHaveText(allPriorities);

  for (const expectedPriority of ['高', '高', 'すべて']) {
    if (expectedPriority === 'すべて') {
      await priority.selectOption('すべて');
    } else {
      await shortcut.click();
    }
    await expect(priority).toHaveValue(expectedPriority);
    await expect(titles).toHaveText(
      expectedPriority === '高'
        ? ['合成対象・旧', '合成対象・新']
        : allPriorities,
    );
    await expect(search).toHaveValue('合成対象');
    await expect(status).toHaveValue('対応中');
    await expect(sort).toHaveValue('oldest');
  }
});

test('高優先度ショートカットをキーボードで操作し、0件なら既存案内を表示する', async ({
  page,
}) => {
  await page.goto('/');
  const priority = page.getByLabel('優先度で絞り込み');
  const shortcut = page.getByRole('button', {
    name: '優先度の高いお問い合わせを表示',
    exact: true,
  });
  await priority.focus();
  await page.keyboard.press('Tab');
  await expect(shortcut).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(priority).toHaveValue('高');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(
    page.getByText('該当するお問い合わせはありません。', {exact: true}),
  ).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('並び順')).toBeFocused();
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
  await expect(page.getByLabel('優先度で絞り込み')).toBeDisabled();
  await expect(
    page.getByRole('button', {name: '優先度の高いお問い合わせを表示'}),
  ).toBeDisabled();
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
    .getByLabel('対応状況')
    .selectOption('完了');
  await expect(
    page.getByRole('article').first().getByLabel('対応状況'),
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
