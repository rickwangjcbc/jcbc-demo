import {
  filterInquiries,
  formatCreatedAt,
  Inquiry,
  loadInquiries,
  normalizeMemo,
  sortInquiries,
  SortOrder,
  summarizeInquiries,
  validateInquiry,
} from './inquiries';
import './style.css';

const STORAGE_KEY = 'jcbc-demo.inquiries.v1';
const STATUSES = ['未対応', '対応中', '完了'];

function element<T extends HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) {
    throw new Error(`画面要素が見つかりません: ${selector}`);
  }
  return result;
}

const form = element<HTMLFormElement>('#inquiry-form');
const title = element<HTMLInputElement>('#title');
const content = element<HTMLTextAreaElement>('#content');
const filter = element<HTMLSelectElement>('#filter');
const priorityFilter = element<HTMLSelectElement>('#priority-filter');
const highPriorityShortcut = element<HTMLButtonElement>(
  '#high-priority-shortcut',
);
const search = element<HTMLInputElement>('#search');
const sortOrder = element<HTMLSelectElement>('#sort-order');
sortOrder.value = 'newest';
const list = element<HTMLDivElement>('#inquiry-list');
const count = element<HTMLParagraphElement>('#count');
const error = element<HTMLParagraphElement>('#error');
const notice = element<HTMLParagraphElement>('#notice');
let inquiries: Inquiry[] = [];
const memoDrafts = new Map<string, string>();
const inquiryDrafts = new Map<string, Pick<Inquiry, 'title' | 'content'>>();
let available = false;

function showError(message: string): void {
  error.textContent = message;
  error.hidden = !message;
  notice.textContent = '';
}

function save(next: Inquiry[]): boolean {
  if (!available) {
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    inquiries = next;
    return true;
  } catch {
    showError(
      'ブラウザに保存できませんでした。保存設定や空き容量を確認してください。変更は保存されていません。',
    );
    return false;
  }
}

function editButton(text: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function renderInquiryText(
  article: HTMLElement,
  item: Inquiry,
): HTMLButtonElement | HTMLInputElement {
  const heading = document.createElement('h3');
  heading.textContent = item.title;
  article.append(heading);

  const draft = inquiryDrafts.get(item.id);
  if (!draft) {
    const body = document.createElement('p');
    body.textContent = item.content;
    const edit = editButton('編集', () => {
      inquiryDrafts.set(item.id, {title: item.title, content: item.content});
      render({id: item.id});
    });
    article.append(body, edit);
    return edit;
  }

  const titleLabel = document.createElement('label');
  titleLabel.textContent = '件名';
  const titleInput = document.createElement('input');
  titleInput.value = draft.title;
  titleInput.addEventListener('input', () => {
    draft.title = titleInput.value;
  });
  titleLabel.append(titleInput);
  const contentLabel = document.createElement('label');
  contentLabel.textContent = '内容';
  const contentInput = document.createElement('textarea');
  contentInput.value = draft.content;
  contentInput.addEventListener('input', () => {
    draft.content = contentInput.value;
  });
  contentLabel.append(contentInput);
  article.append(
    titleLabel,
    contentLabel,
    editButton('保存', () => {
      const errors = validateInquiry(draft.title, draft.content);
      if (errors.length) {
        showError(errors.join('\n'));
        return;
      }
      const next = inquiries.map(current =>
        current.id === item.id
          ? {
              ...current,
              title: draft.title.trim(),
              content: draft.content.trim(),
            }
          : current,
      );
      if (save(next)) {
        inquiryDrafts.delete(item.id);
        showError('');
        notice.textContent = '件名・内容を保存しました。';
        render({id: item.id, fallback: search});
      }
    }),
    editButton('キャンセル', () => {
      inquiryDrafts.delete(item.id);
      render({id: item.id});
    }),
  );
  return titleInput;
}

function render(focus?: {id: string; fallback?: HTMLInputElement}): void {
  list.replaceChildren();
  let focusTarget: HTMLElement | undefined = focus?.fallback;
  const summary = summarizeInquiries(inquiries);
  element('#summary-total').textContent = `全件：${summary.total}件`;
  element('#summary-pending').textContent = `未対応：${summary.pending}件`;
  element('#summary-in-progress').textContent =
    `対応中：${summary.inProgress}件`;
  element('#summary-completed').textContent = `完了：${summary.completed}件`;
  element('#status-summary').hidden = !available;
  const filtered = filterInquiries(
    inquiries,
    filter.value,
    search.value,
    priorityFilter.value,
  );
  if (available) {
    count.textContent = `表示：${filtered.length}件 / 全${inquiries.length}件`;
  }
  count.hidden = !available;
  for (const item of sortInquiries(filtered, sortOrder.value as SortOrder)) {
    const article = document.createElement('article');
    const editControl = renderInquiryText(article, item);
    if (item.id === focus?.id) {
      focusTarget = editControl;
    }
    const createdAt = document.createElement('p');
    createdAt.textContent = `${item.createdAtEstimated ? '登録日時（補完）' : '登録日時'}：${formatCreatedAt(item.createdAt)}`;
    const label = document.createElement('label');
    label.textContent = '対応状況';
    const select = document.createElement('select');
    select.setAttribute('aria-label', `${item.title}の対応状況`);
    for (const status of STATUSES) {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      select.append(option);
    }
    select.value = item.status;
    select.addEventListener('change', () => {
      const next = inquiries.map(current =>
        current.id === item.id ? {...current, status: select.value} : current,
      );
      if (save(next)) {
        showError('');
        notice.textContent = '対応状況を保存しました。';
        render();
      } else {
        select.value = item.status;
      }
    });
    label.append(select);
    const priorityLabel = document.createElement('label');
    priorityLabel.textContent = '優先度';
    const prioritySelect = document.createElement('select');
    prioritySelect.setAttribute('aria-label', `${item.title}の優先度`);
    for (const priority of ['高', '中', '低']) {
      const option = document.createElement('option');
      option.value = priority;
      option.textContent = priority;
      prioritySelect.append(option);
    }
    prioritySelect.value = item.priority;
    prioritySelect.addEventListener('change', () => {
      const next = inquiries.map(current =>
        current.id === item.id
          ? {...current, priority: prioritySelect.value}
          : current,
      );
      if (save(next)) {
        showError('');
        notice.textContent = '優先度を保存しました。';
        render();
      } else {
        prioritySelect.value = item.priority;
      }
    });
    priorityLabel.append(prioritySelect);
    const memoLabel = document.createElement('label');
    memoLabel.textContent = '対応メモ（1,000文字以内）';
    const memo = document.createElement('textarea');
    memo.setAttribute('aria-label', `${item.title}の対応メモ`);
    memo.value = memoDrafts.get(item.id) ?? item.memo ?? '';
    memo.addEventListener('input', () => {
      memoDrafts.set(item.id, memo.value);
    });
    memoLabel.append(memo);
    const saveMemo = document.createElement('button');
    saveMemo.type = 'button';
    saveMemo.textContent = 'メモを保存';
    saveMemo.addEventListener('click', () => {
      let normalized: string;
      try {
        normalized = normalizeMemo(memo.value);
      } catch {
        showError('対応メモは1000文字以内で入力してください。');
        return;
      }
      const next = inquiries.map(current =>
        current.id === item.id ? {...current, memo: normalized} : current,
      );
      if (save(next)) {
        memoDrafts.delete(item.id);
        showError('');
        notice.textContent = 'メモを保存しました！！';
        render();
      }
    });
    article.append(createdAt, label, priorityLabel, memoLabel, saveMemo);
    list.append(article);
  }
  if (!list.childElementCount) {
    const empty = document.createElement('p');
    empty.textContent = '該当するお問い合わせはありません。';
    list.append(empty);
  }
  focusTarget?.focus();
}

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  const loadedAt = new Date().toISOString();
  const candidate = loadInquiries(raw, loadedAt);
  const original = raw === null ? null : JSON.parse(raw);
  const needsSave =
    original === null ||
    candidate.some(
      (item, index) =>
        item.createdAt !== original[index].createdAt ||
        item.createdAtEstimated !== original[index].createdAtEstimated,
    );
  if (needsSave) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
      available = true;
    } catch {
      showError(
        '登録日時の補完データを保存できませんでした。登録・編集を停止しています。保存設定や空き容量を確認して再読み込みしてください。既存データは変更していません。',
      );
    }
  } else {
    available = true;
  }
  if (available) {
    inquiries = candidate;
    render();
  }
} catch {
  showError(
    '保存データを読み込めません。ブラウザの保存設定・データを確認してください。既存データは上書きしていません。',
  );
}
form
  .querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>(
    'input, textarea, button',
  )
  .forEach(control => {
    control.disabled = !available;
  });
filter.disabled = !available;
priorityFilter.disabled = !available;
highPriorityShortcut.disabled = !available;
search.disabled = !available;
sortOrder.disabled = !available;

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!available) {
    return;
  }
  const errors = validateInquiry(title.value, content.value);
  if (errors.length) {
    showError(errors.join('\n'));
    return;
  }
  const next = [
    ...inquiries,
    {
      id: crypto.randomUUID(),
      title: title.value.trim(),
      content: content.value.trim(),
      status: '未対応',
      priority: '中',
      memo: '',
      createdAt: new Date().toISOString(),
      createdAtEstimated: false,
    },
  ];
  if (save(next)) {
    form.reset();
    showError('');
    notice.textContent = 'お問い合わせを登録しました。';
    render();
  }
});
filter.addEventListener('change', () => render());
priorityFilter.addEventListener('change', () => render());
highPriorityShortcut.addEventListener('click', () => {
  priorityFilter.value = '高';
  render();
});
search.addEventListener('input', () => render());

sortOrder.addEventListener('change', () => render());
