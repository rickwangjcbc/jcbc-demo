import argparse
import json
from pathlib import Path
import re
import subprocess

PROMPTS = Path(__file__).resolve().parents[3] / 'prompt-examples.md'
TEMPLATE = re.compile(r'^<!-- prompt: ([a-z][a-z0-9-]*) -->\n\n'
                      r'```text\n([\s\S]*?)\n^```$', re.M)
VARIABLE = re.compile(r'\{\{([a-z][a-z0-9_]*)\}\}')


def git(*arguments):
    result = subprocess.run(['git', *arguments], capture_output=True, text=True)
    if result.returncode:
        raise ValueError(f'Gitで {arguments[0]} を確認できません。対象worktreeで実行してください。')
    return result.stdout.strip()


def set_checked(values, name, verified):
    if name in values and values[name] != verified:
        raise ValueError(f'{name} が確認した値と一致しません。')
    values[name] = verified


def complete_issue(values, names, issue):
    settings = PROMPTS.with_name('project-settings.md').read_text(encoding='utf-8')
    repositories = re.findall(r'^\| 対象 \| GitHub / `([\w.-]+/[\w.-]+)`', settings, re.M | re.ASCII)
    if len(repositories) != 1:
        raise ValueError('project-settings.md で対象リポジトリを一意に特定できません。')
    repository = repositories[0]
    set_checked(values, 'repository', repository)
    if 'issue_url' in names:
        set_checked(values, 'issue_url', f'https://github.com/{repository}/issues/{issue}')
    if 'worktree_path' not in names:
        return None

    root = git('rev-parse', '--show-toplevel')
    remote = git('remote', 'get-url', 'origin')
    prefixes = ('https://github.com/', 'git@github.com:', 'ssh://git@github.com/')
    allowed = {prefix + repository + suffix for prefix in prefixes for suffix in ('', '.git')}
    if remote.lower() not in {url.lower() for url in allowed}:
        raise ValueError('origin が案件設定のリポジトリと一致しません。')
    branch = git('branch', '--show-current')
    if branch not in (f'feature/issue-{issue}', f'feature/issue/{issue}'):
        raise ValueError(f'現在の worktree は Issue #{issue} 用の作業ブランチと照合できません。')
    set_checked(values, 'worktree_path', root)
    if 'branch' in names:
        set_checked(values, 'branch', branch)
    if 'docs_commit' in names and not values.get('docs_commit'):
        return git('rev-parse', 'HEAD')
    return None


def main():
    parser = argparse.ArgumentParser(description='指定したテンプレートをJSONの値で展開します。')
    parser.add_argument('template')
    parser.add_argument('variables', type=Path, nargs='?')
    parser.add_argument('--issue', help='対象Issueの番号。URLと必要な作業場所を補完します。')
    parser.add_argument('--docs-commit', help='人間が確認済みの採用資料コミットSHA。')
    args = parser.parse_args()
    if args.issue is not None and not re.fullmatch(r'[1-9][0-9]*', args.issue):
        parser.error('--issue に正の整数を指定してください。')
    try:
        matches = [body for name, body in TEMPLATE.findall(PROMPTS.read_text(encoding='utf-8'))
                   if name == args.template]
        if len(matches) != 1:
            parser.error(f'テンプレートが見つからないか重複しています: {args.template}')
        values = json.loads(args.variables.read_text(encoding='utf-8')) if args.variables else {}
    except (OSError, ValueError) as exc:
        parser.error(f'テンプレートまたはJSONを読み取れません: {exc}')
    if not isinstance(values, dict):
        parser.error('変数ファイルはJSONオブジェクトにしてください。')
    body = matches[0]
    names = dict.fromkeys(VARIABLE.findall(body))
    head = None
    try:
        if args.docs_commit is not None:
            if not re.fullmatch(r'[0-9a-fA-F]{40}|[0-9a-fA-F]{64}', args.docs_commit):
                raise ValueError('--docs-commit には確認済みの完全なコミットSHAを指定してください。')
            set_checked(values, 'docs_commit', args.docs_commit)
        if args.issue is not None:
            head = complete_issue(values, names, args.issue)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    if args.template == 'issue-specification' and args.issue is not None and values.get('docs_commit'):
        for name in ('existing_design', 'business_contact', 'design_approver'):
            values.setdefault(name, '未確認（Issue・案件設定を確認し、特定できない場合だけ依頼者に確認）')
    missing = [name for name in names if not isinstance(values.get(name), str)
               or not values[name].strip()]
    if missing:
        message = '不足または空欄の項目: ' + ', '.join(missing)
        if 'docs_commit' in missing and head:
            message += f'\n採用資料の候補（HEAD）: {head}。採用版を確認して --docs-commit またはJSONの docs_commit に指定してください。未コミットの変更はこのSHAに含まれません。'
        parser.error(message)
    print(VARIABLE.sub(lambda match: values[match[1]], body))


if __name__ == '__main__':
    main()
