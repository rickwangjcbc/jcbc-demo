/** A single inquiry stored only in this browser. */
export interface Inquiry {
  id: string;
  title: string;
  content: string;
  status: string;
  priority?: string;
}

/** Combines priority, status and case-insensitive substring filters. */
export function filterInquiries(
  inquiries: readonly Inquiry[],
  status: string,
  keyword: string,
  priority = 'すべて',
): Inquiry[] {
  const query = keyword.toLowerCase();
  return inquiries.filter(
    item =>
      (status === 'すべて' || item.status === status) &&
      (priority === 'すべて' || (item.priority ?? '中') === priority) &&
      (item.title.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query)),
  );
}

/** Validates code-point lengths and rejects blank-only inputs. */
export function validateInquiry(title: string, content: string): string[] {
  const errors: string[] = [];
  for (const [name, value, limit] of [
    ['件名', title, 100],
    ['内容', content, 1000],
  ] as const) {
    if (!value.trim()) {
      errors.push(`${name}は必須です。`);
    } else if ([...value].length > limit) {
      errors.push(`${name}は${limit}文字以内で入力してください。`);
    }
  }
  return errors;
}

/** Loads saved inquiries, or synthetic samples on the first visit. */
export function loadInquiries(raw: string | null): Inquiry[] {
  if (raw !== null) {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) {
      throw new Error('保存データの形式が不正です。');
    }
    const ids = new Set<string>();
    for (const item of value) {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof item.id !== 'string' ||
        !item.id ||
        ids.has(item.id) ||
        typeof item.title !== 'string' ||
        typeof item.content !== 'string' ||
        validateInquiry(item.title, item.content).length > 0 ||
        !['未対応', '対応中', '完了'].includes(item.status) ||
        (item.priority !== undefined &&
          !['高', '中', '低'].includes(item.priority))
      ) {
        throw new Error('保存データの形式が不正です。');
      }
      ids.add(item.id);
    }
    return value.map(item => ({...item, priority: item.priority ?? '中'}));
  }
  return [
    {
      id: 'sample-1',
      title: 'デモ操作の確認',
      content: '登録方法を教えてください。',
      status: '未対応',
      priority: '中',
    },
    {
      id: 'sample-2',
      title: '画面表示について',
      content: '一覧の見方を確認したいです。',
      status: '対応中',
      priority: '中',
    },
    {
      id: 'sample-3',
      title: '利用手順の確認',
      content: '操作手順を確認しました。',
      status: '完了',
      priority: '中',
    },
  ];
}
