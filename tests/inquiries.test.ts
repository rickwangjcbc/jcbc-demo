import {describe, expect, it} from 'vitest';

import {
  filterInquiries,
  loadInquiries,
  validateInquiry,
} from '../src/inquiries';

describe('キーワード検索', () => {
  it.each(['未対応', '対応中', '完了'])(
    '検索と対応状況の両方を満たす項目だけ返す: %s',
    status => {
      const items = loadInquiries(null);
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
      const items = loadInquiries(null);
      expect(filterInquiries(items, status, '')).toEqual(
        status === 'すべて'
          ? items
          : items.filter(item => item.status === status),
      );
    },
  );
  it('非一致・空配列を空の結果として返す', () => {
    expect(
      filterInquiries(loadInquiries(null), 'すべて', '存在しない'),
    ).toEqual([]);
    expect(filterInquiries([], 'すべて', '')).toEqual([]);
  });
  it('正規表現ではなく文字列として検索し元データと順序を保持する', () => {
    const items = [
      {id: '1', title: 'API [demo]', content: '本文', status: '未対応'},
      {id: '2', title: 'API demo', content: '本文', status: '完了'},
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
        {id: '1', title: 'Demo API setup', content: '本文', status: '未対応'},
        {id: '2', title: '件名', content: 'Use Api here', status: '完了'},
      ];
      expect(filterInquiries(items, 'すべて', keyword)).toEqual(items);
    },
  );
  it('件名の部分一致で絞り込む', () => {
    const items = loadInquiries(null);
    expect(filterInquiries(items, 'すべて', '表示')).toEqual([items[1]]);
  });
  it('内容の部分一致で絞り込む', () => {
    const items = loadInquiries(null);
    expect(filterInquiries(items, 'すべて', '見方')).toEqual([items[1]]);
  });
});

describe('優先度', () => {
  it.each(['高', '中', '低'])('保存済み優先度を復元する: %s', priority => {
    const items = [
      {id: 'saved', title: '件名', content: '本文', status: '完了', priority},
    ];
    expect(loadInquiries(JSON.stringify(items))).toEqual(items);
  });
  it.each(['緊急', '', null, 1, {}])('不正な優先度を拒否する: %j', priority => {
    const items = [
      {id: 'bad', title: '件名', content: '本文', status: '完了', priority},
    ];
    expect(() => loadInquiries(JSON.stringify(items))).toThrow();
  });
  it.each(['高', '中', '低'])(
    '優先度で絞り込み他の条件も維持する: %s',
    priority => {
      const items = ['高', '中', '低'].flatMap((value, index) => [
        {
          id: `${index}-match`,
          title: 'API',
          content: '本文',
          status: '完了',
          priority: value,
        },
        {
          id: `${index}-status`,
          title: 'API',
          content: '本文',
          status: '未対応',
          priority: value,
        },
        {
          id: `${index}-keyword`,
          title: '別件',
          content: '本文',
          status: '完了',
          priority: value,
        },
      ]);
      const before = JSON.stringify(items);
      expect(filterInquiries(items, '完了', 'api', priority)).toEqual(
        items.filter(
          item =>
            item.priority === priority &&
            item.status === '完了' &&
            item.title === 'API',
        ),
      );
      expect(filterInquiries(items, '完了', 'api', 'すべて')).toEqual(
        items.filter(item => item.status === '完了' && item.title === 'API'),
      );
      expect(JSON.stringify(items)).toBe(before);
    },
  );
  it('優先度のない項目を中として絞り込む', () => {
    const items = [{id: 'old', title: '件名', content: '本文', status: '完了'}];
    expect(filterInquiries(items, 'すべて', '', '中')).toEqual(items);
    expect(filterInquiries(items, 'すべて', '', '高')).toEqual([]);
  });
  it('初回サンプルの優先度を中にする', () => {
    expect(loadInquiries(null).map(item => item.priority)).toEqual([
      '中',
      '中',
      '中',
    ]);
  });
  it('優先度のない既存データを中として扱い他の項目を維持する', () => {
    const items = [
      {
        id: 'legacy',
        title: '既存の件名',
        content: '既存の本文',
        status: '完了',
      },
    ];
    expect(loadInquiries(JSON.stringify(items))).toEqual([
      {...items[0], priority: '中'},
    ]);
  });
});

describe('初回データ', () => {
  it('保存済みの状態を復元する', () => {
    const items = [
      {id: 'saved', title: '件名', content: '本文', status: '完了'},
    ];
    expect(loadInquiries(JSON.stringify(items))).toEqual([
      {...items[0], priority: '中'},
    ]);
  });
  it('保存済みの空配列にサンプルを再投入しない', () => {
    expect(loadInquiries('[]')).toEqual([]);
  });
  it.each(['not json', '{}', '[null]', '[{"id":"x"}]'])(
    '壊れた保存データを拒否する: %s',
    raw => {
      expect(() => loadInquiries(raw)).toThrow();
    },
  );
  it('不正な対応状況を拒否する', () => {
    expect(() =>
      loadInquiries(
        JSON.stringify([
          {id: 'x', title: '件名', content: '本文', status: 'unknown'},
        ]),
      ),
    ).toThrow();
  });
  it('重複IDを拒否する', () => {
    const item = {id: 'x', title: '件名', content: '本文', status: '未対応'};
    expect(() => loadInquiries(JSON.stringify([item, item]))).toThrow();
  });
  it('呼び出しごとに独立したサンプルを返す', () => {
    const items = loadInquiries(null);
    items[0].title = '変更';
    expect(loadInquiries(null)[0].title).not.toBe('変更');
  });
  it('保存データがなければ合成サンプルを3件用意する', () => {
    const items = loadInquiries(null);
    expect(items).toHaveLength(3);
    expect(new Set(items.map(item => item.id)).size).toBe(3);
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
