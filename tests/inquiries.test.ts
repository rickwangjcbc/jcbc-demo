import {describe, expect, it} from 'vitest';

import {
  filterInquiries,
  formatCreatedAt,
  sortInquiries,
  summarizeInquiries,
  loadInquiries,
  normalizeMemo,
  validateInquiry,
} from '../src/inquiries';

const loadedAt = '2026-11-18T01:02:03.456Z';
const estimatedDate = {createdAt: loadedAt, createdAtEstimated: true};

describe('summarizeInquiries', () => {
  it('空配列では全項目を0件にする', () => {
    expect(summarizeInquiries([])).toEqual({
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
    });
  });
  it.each([
    ['未対応', {total: 2, pending: 2, inProgress: 0, completed: 0}],
    ['対応中', {total: 2, pending: 0, inProgress: 2, completed: 0}],
    ['完了', {total: 2, pending: 0, inProgress: 0, completed: 2}],
  ])('全件が%sでも状況別に集計する', (status, expected) => {
    const items = loadInquiries(null, loadedAt)
      .slice(0, 2)
      .map(item => ({...item, status}));
    expect(summarizeInquiries(items)).toEqual(expected);
  });
  it('異なる件数の状況を集計し、入力配列・要素・順序を変更しない', () => {
    const sample = loadInquiries(null, loadedAt)[0];
    const items = Object.freeze(
      ['完了', '未対応', '対応中', '完了', '対応中', '完了'].map(
        (status, index) =>
          Object.freeze({...sample, id: String(index), status}),
      ),
    );
    const before = JSON.stringify(items);
    const summary = summarizeInquiries(items);
    expect(summary).toEqual({
      total: 6,
      pending: 1,
      inProgress: 2,
      completed: 3,
    });
    expect(summary.total).toBe(items.length);
    expect(summary.pending + summary.inProgress + summary.completed).toBe(6);
    expect(JSON.stringify(items)).toBe(before);
  });
});

describe('キーワード検索', () => {
  it.each(['未対応', '対応中', '完了'])(
    '検索と対応状況の両方を満たす項目だけ返す: %s',
    status => {
      const items = loadInquiries(null, loadedAt);
      expect(filterInquiries(items, status, '確認')).toEqual(
        items.filter(item => item.status === status),
      );
      expect(filterInquiries(items, status, '表示')).toEqual(
        status === '対応中' ? [items[1]] : [],
      );
    },
  );
  it.each(['すべて', '未対応', '対応中', '完了'])(
    '空文字では検索だけ解除する: %s',
    status => {
      const items = loadInquiries(null, loadedAt);
      expect(filterInquiries(items, status, '')).toEqual(
        status === 'すべて'
          ? items
          : items.filter(item => item.status === status),
      );
    },
  );
  it('非一致・空配列を空の結果として返す', () => {
    expect(
      filterInquiries(loadInquiries(null, loadedAt), 'すべて', '存在しない'),
    ).toEqual([]);
    expect(filterInquiries([], 'すべて', '')).toEqual([]);
  });
  it('正規表現ではなく文字列として検索し元データと順序を保持する', () => {
    const items = [
      {
        id: '1',
        title: 'API [demo]',
        content: '本文',
        status: '未対応',
        priority: '中',
        ...estimatedDate,
      },
      {
        id: '2',
        title: 'API demo',
        content: '本文',
        status: '完了',
        priority: '中',
        ...estimatedDate,
      },
    ];
    const before = JSON.stringify(items);
    expect(filterInquiries(items, 'すべて', '[')).toEqual([items[0]]);
    expect(filterInquiries(items, 'すべて', 'api')).toEqual(items);
    expect(JSON.stringify(items)).toBe(before);
  });
  it.each(['api', 'API', 'aPi'])(
    '件名・内容とも英字の大小を区別しない: %s',
    keyword => {
      const items = [
        {
          id: '1',
          title: 'Demo API setup',
          content: '本文',
          status: '未対応',
          priority: '中',
          ...estimatedDate,
        },
        {
          id: '2',
          title: '件名',
          content: 'Use Api here',
          status: '完了',
          priority: '中',
          ...estimatedDate,
        },
      ];
      expect(filterInquiries(items, 'すべて', keyword)).toEqual(items);
    },
  );
  it('件名の部分一致で絞り込む', () => {
    const items = loadInquiries(null, loadedAt);
    expect(filterInquiries(items, 'すべて', '表示')).toEqual([items[1]]);
  });
  it('内容の部分一致で絞り込む', () => {
    const items = loadInquiries(null, loadedAt);
    expect(filterInquiries(items, 'すべて', '見方')).toEqual([items[1]]);
  });
});

describe('優先度', () => {
  it('新規サンプルは「中」を持ち、指定した優先度で絞り込む', () => {
    const items = loadInquiries(null, loadedAt);
    expect(items[0].priority).toBe('中');
    expect(filterInquiries(items, 'すべて', '', '中')).toEqual(items);
    expect(filterInquiries(items, 'すべて', '', '高')).toEqual([]);
  });
  it('優先度のない既存データは「中」として読み込み他の値を維持する', () => {
    const legacy = [
      {id: 'saved', title: '既存件名', content: '既存内容', status: '対応中'},
    ];
    expect(loadInquiries(JSON.stringify(legacy), loadedAt)).toEqual([
      {
        ...legacy[0],
        priority: '中',
        memo: '',
        ...estimatedDate,
      },
    ]);
  });
  it('状態・キーワード・優先度をAND条件で絞り込む', () => {
    const items = [
      {
        id: '1',
        title: 'API問い合わせ',
        content: '本文',
        status: '未対応',
        priority: '高',
        ...estimatedDate,
      },
      {
        id: '2',
        title: 'API問い合わせ',
        content: '本文',
        status: '完了',
        priority: '高',
        ...estimatedDate,
      },
      {
        id: '3',
        title: 'API問い合わせ',
        content: '本文',
        status: '未対応',
        priority: '低',
        ...estimatedDate,
      },
    ];
    expect(filterInquiries(items, '未対応', 'API', '高')).toEqual([items[0]]);
  });
});

describe('初回データ', () => {
  it('保存済みの状態を復元する', () => {
    const items = [
      {
        id: 'saved',
        title: '件名',
        content: '本文',
        status: '完了',
        priority: '中',
      },
    ];
    expect(loadInquiries(JSON.stringify(items), loadedAt)).toEqual([
      {...items[0], memo: '', ...estimatedDate},
    ]);
  });
  it('保存済みの空配列にサンプルを再投入しない', () => {
    expect(loadInquiries('[]', loadedAt)).toEqual([]);
  });
  it.each(['not json', '{}', '[null]', '[{"id":"x"}]'])(
    '壊れた保存データを拒否する: %s',
    raw => {
      expect(() => loadInquiries(raw, loadedAt)).toThrow();
    },
  );
  it('不正な対応状況を拒否する', () => {
    expect(() =>
      loadInquiries(
        JSON.stringify([
          {id: 'x', title: '件名', content: '本文', status: 'unknown'},
        ]),
        loadedAt,
      ),
    ).toThrow();
  });
  it('重複IDを拒否する', () => {
    const item = {
      id: 'x',
      title: '件名',
      content: '本文',
      status: '未対応',
      priority: '中',
    };
    expect(() =>
      loadInquiries(JSON.stringify([item, item]), loadedAt),
    ).toThrow();
  });
  it('呼び出しごとに独立したサンプルを返す', () => {
    const items = loadInquiries(null, loadedAt);
    items[0].title = '変更';
    expect(loadInquiries(null, loadedAt)[0].title).not.toBe('変更');
  });
  it('保存データがなければ合成サンプルを3件用意する', () => {
    const items = loadInquiries(null, loadedAt);
    expect(items).toHaveLength(3);
    expect(new Set(items.map(item => item.id)).size).toBe(3);
  });
});

describe('対応メモ', () => {
  it.each(['あ'.repeat(1000), '😀'.repeat(1000), ` ${'あ'.repeat(998)}\n`])(
    '1000コードポイントの入力をそのまま保持する',
    memo => {
      expect(normalizeMemo(memo)).toBe(memo);
    },
  );
  it.each([
    'あ'.repeat(1001),
    '😀'.repeat(1001),
    ` ${'あ'.repeat(999)}\n`,
    ' '.repeat(1001),
    '\n'.repeat(1001),
  ])('空白・改行を含む入力全体の上限超過を正規化前に拒否する', memo => {
    expect(() => normalizeMemo(memo)).toThrow('1000文字以内');
  });
  it('非空白メモの前後空白・改行を保持する', () => {
    expect(normalizeMemo(' \n　対応内容\n次の作業　\n ')).toBe(
      ' \n　対応内容\n次の作業　\n ',
    );
  });
  it.each(['', ' \n　\t', ' '.repeat(1000)])(
    '空白・改行だけの入力は空文字として扱う',
    memo => {
      expect(normalizeMemo(memo)).toBe('');
    },
  );
  it('旧データの他項目を維持してメモを空欄として読み込む', () => {
    const legacy = {
      id: 'legacy',
      title: '既存件名',
      content: '既存内容',
      status: '対応中',
      priority: '高',
    };
    expect(loadInquiries(JSON.stringify([legacy]), loadedAt)).toEqual([
      {...legacy, memo: '', ...estimatedDate},
    ]);
    expect(loadInquiries(null, loadedAt).every(item => item.memo === '')).toBe(
      true,
    );
  });
  it.each([null, 123, {}, 'あ'.repeat(1001)])(
    '不正な保存済みメモを拒否する',
    memo => {
      expect(() =>
        loadInquiries(
          JSON.stringify([
            {
              id: 'invalid',
              title: '件名',
              content: '内容',
              status: '未対応',
              memo,
            },
          ]),
          loadedAt,
        ),
      ).toThrow();
    },
  );
  it('保存済みメモを復元し検索対象には含めない', () => {
    const saved = {
      id: 'saved',
      title: '既存件名',
      content: '既存内容',
      status: '完了',
      priority: '低',
      memo: ' \nメモ限定語\n ',
    };
    const items = loadInquiries(JSON.stringify([saved]), loadedAt);
    expect(items).toEqual([{...saved, ...estimatedDate}]);
    expect(filterInquiries(items, 'すべて', 'メモ限定語')).toEqual([]);
  });
});

describe('入力検証', () => {
  it.each([
    ['', '本文', '件名'],
    ['　 ', '本文', '件名'],
    ['あ'.repeat(101), '本文', '件名'],
    ['件名', '', '内容'],
    ['件名', '　 ', '内容'],
    ['件名', 'あ'.repeat(1001), '内容'],
  ])('不正な入力の理由を返す', (title, content, field) => {
    expect(validateInquiry(title, content).join()).toContain(field);
  });
  it('上限ちょうどの日本語・絵文字を受け付ける', () => {
    expect(validateInquiry('😀'.repeat(100), 'あ'.repeat(1000))).toEqual([]);
  });
});

describe('登録日時の読込・並べ替え・表示', () => {
  const legacy = {
    id: 'legacy',
    title: 'API件名',
    content: '本文',
    status: '対応中',
    priority: '高',
    memo: ' \n既存メモ\n ',
    extra: '維持',
  };
  it.each([
    undefined,
    null,
    '',
    'invalid',
    123,
    true,
    [],
    {},
    '2026-02-30T00:00:00.000Z',
    '2026-01-01',
    '2026-01-01T00:00:00Z',
    '2026-01-01T09:00:00.000+09:00',
  ])('欠落・不正日時を共通時刻で補完する: %j', createdAt => {
    const raw = [
      {...legacy, createdAt, createdAtEstimated: 'invalid'},
      {...legacy, id: 'second'},
    ];
    expect(loadInquiries(JSON.stringify(raw), loadedAt)).toEqual([
      {...legacy, ...estimatedDate},
      {...legacy, id: 'second', ...estimatedDate},
    ]);
  });
  it('有効日時とbooleanフラグを維持し欠落フラグだけfalseにする', () => {
    const createdAt = '2024-02-29T15:00:00.123Z';
    const items = [true, false, undefined].map((createdAtEstimated, i) => ({
      ...legacy,
      id: String(i),
      createdAt,
      createdAtEstimated,
    }));
    expect(loadInquiries(JSON.stringify(items), loadedAt)).toEqual([
      {...items[0], createdAtEstimated: true},
      {...items[1], createdAtEstimated: false},
      {...items[2], createdAtEstimated: false},
    ]);
  });
  it.each([null, 0, 'true', {}, []])(
    '有効日時の不正フラグを拒否する: %j',
    createdAtEstimated => {
      expect(() =>
        loadInquiries(
          JSON.stringify([
            {
              ...legacy,
              createdAt: loadedAt,
              createdAtEstimated,
            },
          ]),
          loadedAt,
        ),
      ).toThrow('保存データの形式が不正');
    },
  );
  it('全サンプルを共通の補完日時にする', () => {
    const samples = loadInquiries(null, loadedAt);
    expect(samples).toHaveLength(3);
    expect(
      samples.map(({createdAt, createdAtEstimated}) => ({
        createdAt,
        createdAtEstimated,
      })),
    ).toEqual([estimatedDate, estimatedDate, estimatedDate]);
  });
  it('ミリ秒単位で非破壊ソートし同時刻は両方向とも保存配列順を維持する', () => {
    const items = [
      '2026-01-01T00:00:00.200Z',
      '2026-01-01T00:00:00.100Z',
      '2026-01-01T00:00:00.200Z',
      '2026-01-01T00:00:00.300Z',
    ].map((createdAt, i) =>
      Object.freeze({
        ...legacy,
        id: String(i),
        createdAt,
        createdAtEstimated: false,
      }),
    );
    Object.freeze(items);
    const before = JSON.stringify(items);
    expect(sortInquiries(items, 'newest').map(item => item.id)).toEqual([
      '3',
      '0',
      '2',
      '1',
    ]);
    expect(sortInquiries(items, 'oldest').map(item => item.id)).toEqual([
      '1',
      '0',
      '2',
      '3',
    ]);
    expect(sortInquiries(items, 'newest')[1]).toBe(items[0]);
    expect(JSON.stringify(items)).toBe(before);
    expect(sortInquiries([], 'newest')).toEqual([]);
    expect(
      sortInquiries(
        filterInquiries(items, '対応中', 'api', '高'),
        'oldest',
      ).map(item => item.id),
    ).toEqual(['1', '0', '2', '3']);
  });
  it.each([
    ['2026-12-31T15:00:00.000Z', '2027/01/01 00:00:00'],
    ['2024-02-29T14:59:59.999Z', '2024/02/29 23:59:59'],
    ['2026-01-02T18:04:05.001Z', '2026/01/03 03:04:05'],
  ])('JSTの秒までの24時間表記にする: %s', (createdAt, expected) => {
    expect(formatCreatedAt(createdAt)).toBe(expected);
  });
});
