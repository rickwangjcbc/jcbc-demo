import {describe, expect, it} from 'vitest';

import {loadInquiries, validateInquiry} from '../src/inquiries';

describe('初回データ', () => {
  it('保存済みの状態を復元する', () => {
    const items = [
      {id: 'saved', title: '件名', content: '本文', status: '完了'},
    ];
    expect(loadInquiries(JSON.stringify(items))).toEqual(items);
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
