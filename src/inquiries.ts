/** A single inquiry stored only in this browser. */
export interface Inquiry {
  id: string;
  title: string;
  content: string;
  status: string;
  priority: string;
  memo?: string;
  createdAt: string;
  createdAtEstimated: boolean;
}

/** Filters by status, priority, and a case-insensitive title or content substring. */
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

/** 入力全体のコードポイント数を検証し、空白だけのメモを空文字にする。 */
export function normalizeMemo(memo: string): string {
  if ([...memo].length > 1000) {
    throw new Error('対応メモは1000文字以内で入力してください。');
  }
  return memo.trim() ? memo : '';
}

/** Loads saved inquiries, or synthetic samples on the first visit. */
export function loadInquiries(raw: string | null, loadedAt: string): Inquiry[] {
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
        (item.memo !== undefined &&
          (typeof item.memo !== 'string' || [...item.memo].length > 1000)) ||
        !['未対応', '対応中', '完了'].includes(item.status)
      ) {
        throw new Error('保存データの形式が不正です。');
      }
      ids.add(item.id);
    }
    return value.map(item => {
      const timestamp =
        typeof item.createdAt === 'string' ? Date.parse(item.createdAt) : NaN;
      const validDate =
        Number.isFinite(timestamp) &&
        new Date(timestamp).toISOString() === item.createdAt;
      if (
        validDate &&
        item.createdAtEstimated !== undefined &&
        typeof item.createdAtEstimated !== 'boolean'
      ) {
        throw new Error('保存データの形式が不正です。');
      }
      return {
        ...item,
        priority: item.priority ?? '中',
        memo: item.memo ?? '',
        createdAt: validDate ? item.createdAt : loadedAt,
        createdAtEstimated: validDate
          ? (item.createdAtEstimated ?? false)
          : true,
      };
    }) as Inquiry[];
  }
  return [
    {
      id: 'sample-1',
      title: 'デモ操作の確認',
      content: '登録方法を教えてください。',
      status: '未対応',
      priority: '中',
      memo: '',
      createdAt: loadedAt,
      createdAtEstimated: true,
    },
    {
      id: 'sample-2',
      title: '画面表示について',
      content: '一覧の見方を確認したいです。',
      status: '対応中',
      priority: '中',
      memo: '',
      createdAt: loadedAt,
      createdAtEstimated: true,
    },
    {
      id: 'sample-3',
      title: '利用手順の確認',
      content: '操作手順を確認しました。',
      status: '完了',
      priority: '中',
      memo: '',
      createdAt: loadedAt,
      createdAtEstimated: true,
    },
  ];
}

export type SortOrder = 'newest' | 'oldest';

/** 登録日時で非破壊ソートし、同時刻は入力配列順を維持する。 */
export function sortInquiries(
  inquiries: readonly Inquiry[],
  order: SortOrder,
): Inquiry[] {
  return inquiries
    .map((item, index) => ({item, index}))
    .sort((a, b) => {
      const difference =
        Date.parse(a.item.createdAt) - Date.parse(b.item.createdAt);
      return (
        (order === 'newest' ? -difference : difference) || a.index - b.index
      );
    })
    .map(({item}) => item);
}

/** 保存済み登録日時を端末設定に依存しないJSTの秒表記にする。 */
export function formatCreatedAt(createdAt: string): string {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    calendar: 'gregory',
    numberingSystem: 'latn',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(createdAt));
  const part = (type: Intl.DateTimeFormatPartTypes, length = 2): string =>
    parts.find(part => part.type === type)!.value.padStart(length, '0');
  return `${part('year', 4)}/${part('month')}/${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`;
}
