import {Inquiry, loadInquiries, validateInquiry} from './inquiries';
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
const list = element<HTMLDivElement>('#inquiry-list');
const error = element<HTMLParagraphElement>('#error');
const notice = element<HTMLParagraphElement>('#notice');
let inquiries: Inquiry[] = [];
let available = false;

function showError(message: string): void {
  error.textContent = message;
  error.hidden = !message;
  notice.textContent = '';
}

function save(next: Inquiry[]): boolean {
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

function render(): void {
  list.replaceChildren();
  element('#count').textContent = `全${inquiries.length}件`;
  for (const item of inquiries) {
    if (filter.value !== 'すべて' && filter.value !== item.status) {
      continue;
    }
    const article = document.createElement('article');
    const heading = document.createElement('h3');
    heading.textContent = item.title;
    const body = document.createElement('p');
    body.textContent = item.content;
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
    article.append(heading, body, label);
    list.append(article);
  }
  if (!list.childElementCount) {
    const empty = document.createElement('p');
    empty.textContent = '該当するお問い合わせはありません。';
    list.append(empty);
  }
}

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  inquiries = loadInquiries(raw);
  available = raw !== null || save(inquiries);
  if (available) {
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
    },
  ];
  if (save(next)) {
    form.reset();
    showError('');
    notice.textContent = 'お問い合わせを登録しました。';
    render();
  }
});
filter.addEventListener('change', render);
