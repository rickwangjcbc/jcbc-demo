import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[1]
CLI = SKILL / 'scripts' / 'render.py'
PROMPTS = SKILL.parents[1] / 'prompt-examples.md'
NAMES = ('session-start', 'issue-creation', 'issue-interview', 'issue-specification',
         'design-approval', 'issue-delivery', 'pr-review-response', 'merge-ready',
         'post-merge', 'delivery-from-file', 'resume')


class RenderTests(unittest.TestCase):
    def run_cli(self, name, data, *options, cwd=None):
        with tempfile.TemporaryDirectory() as folder:
            config = Path(folder) / 'issue 42.json'
            paths = []
            if data is not None:
                config.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
                paths.append(str(config))
            return subprocess.run([sys.executable, str(CLI), name, *paths, *options],
                                  cwd=cwd, capture_output=True, text=True, encoding='utf-8')

    def issue_repo(self, branch, remote='git@github.com:rickwangjcbc/jcbc-demo.git'):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        repo = Path(folder.name).resolve()
        for command in (('init', '-q'), ('symbolic-ref', 'HEAD', f'refs/heads/{branch}'),
                        ('remote', 'add', 'origin', remote),
                        ('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                         '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'fixture')):
            subprocess.run(['git', '-C', str(repo), *command], check=True, capture_output=True)
        return repo

    def test_issue_number_resolves_url_and_worktree(self):
        repo = self.issue_repo('feature/issue/42')
        config = {'docs_commit': 'a' * 40, 'existing_design': 'なし',
                  'business_contact': '業務窓口', 'design_approver': '設計承認者'}
        result = self.run_cli('issue-specification', config, '--issue', '42', cwd=repo)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('https://github.com/rickwangjcbc/jcbc-demo/issues/42', result.stdout)
        self.assertIn(f'作業場所：{repo}', result.stdout)
        self.assertIn('採用資料：' + config['docs_commit'], result.stdout)

    def test_design_preview_needs_no_json(self):
        repo = self.issue_repo('feature/issue-42')
        sha = 'a' * 40
        result = self.run_cli('issue-specification', None, '--issue', '42',
                              '--docs-commit', sha, cwd=repo)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('/issues/42', result.stdout)
        self.assertIn(f'作業場所：{repo}', result.stdout)
        self.assertIn(f'採用資料：{sha}', result.stdout)
        for label in ('既存の設計資料', '業務上の確認窓口', '技術的な設計承認者'):
            self.assertIn(f'{label}：未確認', result.stdout)
        self.assertNotIn('{{', result.stdout)

    def test_design_preview_without_confirmed_sha_stops(self):
        repo = self.issue_repo('feature/issue-42')
        result = self.run_cli('issue-specification', None, '--issue', '42', cwd=repo)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, '')
        self.assertRegex(result.stderr, r'HEAD.{0,30}[0-9a-f]{40}')

    def test_delivery_does_not_invent_approval_without_json(self):
        repo = self.issue_repo('feature/issue-42')
        result = self.run_cli('issue-delivery', None, '--issue', '42',
                              '--docs-commit', 'a' * 40, cwd=repo)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, '')
        self.assertIn('design_approval_record', result.stderr)

    def test_docs_commit_flag_cannot_override_json(self):
        repo = self.issue_repo('feature/issue-42')
        result = self.run_cli('issue-specification', {'docs_commit': 'a' * 40},
                              '--issue', '42', '--docs-commit', 'b' * 40, cwd=repo)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, '')
        self.assertIn('docs_commit が確認した値と一致しません', result.stderr)

    def test_wrong_worktree_or_conflicting_target_stops(self):
        for branch, remote, extra, error in (
            ('feature/issue-7', 'https://github.com/rickwangjcbc/jcbc-demo.git', {}, 'worktree'),
            ('feature/issue-42', 'https://github.com/other/jcbc-demo.git', {}, 'origin'),
            ('feature/issue-42', 'https://github.com/rickwangjcbc/jcbc-demo.git',
             {'issue_url': 'https://github.com/rickwangjcbc/jcbc-demo/issues/7'}, 'issue_url'),
        ):
            with self.subTest(branch=branch, error=error):
                repo = self.issue_repo(branch, remote)
                result = self.run_cli('issue-specification', extra, '--issue', '42', cwd=repo)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, '')
                self.assertIn(error, result.stderr)

    def test_unconfirmed_docs_commit_only_shows_candidate(self):
        repo = self.issue_repo('feature/issue-42')
        result = self.run_cli('issue-specification', {}, '--issue', '42', cwd=repo)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, '')
        self.assertRegex(result.stderr, r'HEAD.{0,30}[0-9a-f]{40}')
        self.assertIn('docs_commit', result.stderr)
        for field in ('existing_design', 'business_contact', 'design_approver'):
            self.assertIn(field, result.stderr)

    def test_remote_only_template_does_not_require_worktree(self):
        with tempfile.TemporaryDirectory() as folder:
            result = self.run_cli('post-merge', {'docs_commit': 'fixed-sha', 'pr_url': 'P'},
                                  '--issue', '42', cwd=folder)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('/issues/42', result.stdout)

    def test_all_templates_render_from_one_config(self):
        doc = PROMPTS.read_text(encoding='utf-8')
        self.assertEqual(tuple(re.findall(r'^<!-- prompt: ([a-z-]+) -->$', doc, re.M)), NAMES)
        config = json.loads((SKILL / 'variables.example.json').read_text(encoding='utf-8'))
        for name in NAMES:
            with self.subTest(name=name):
                result = self.run_cli(name, config)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertTrue(result.stdout.strip())
                self.assertNotIn('{{', result.stdout)
                self.assertNotIn('＜', result.stdout)
        for name in ('issue-specification', 'issue-delivery', 'pr-review-response'):
            self.assertIn(config['issue_url'], self.run_cli(name, config).stdout)

    def test_only_selected_template_fields_are_required(self):
        config = {'issue_url': 'https://example.invalid/issues/42',
                  'pr_url': 'https://example.invalid/pull/43', 'docs_commit': 'example-sha'}
        result = self.run_cli('post-merge', config)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(config['pr_url'], result.stdout)

    def test_blank_and_missing_fields_stop_without_partial_output(self):
        result = self.run_cli('issue-specification', {'issue_url': ' ', 'existing_design': 'なし'})
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, '')
        for field in ('issue_url', 'worktree_path', 'docs_commit', 'business_contact', 'design_approver'):
            self.assertIn(field, result.stderr)
        self.assertNotIn('existing_design', result.stderr)

    def test_unknown_name_and_non_string_values_are_rejected(self):
        for name, data, error in [('unknown', {}, 'unknown'),
                                  ('post-merge', {'pr_url': 42}, 'pr_url'),
                                  ('post-merge', [], 'JSON')]:
            with self.subTest(name=name, data=data):
                result = self.run_cli(name, data)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, '')
                self.assertIn(error, result.stderr)

    def test_multiline_values_are_inserted_literally_once(self):
        value = '資料は複数行です\n$HOME \\ {{not_a_second_pass}}'
        result = self.run_cli('post-merge', {'issue_url': 'I', 'pr_url': 'P', 'docs_commit': value})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(value, result.stdout)


if __name__ == '__main__':
    unittest.main()
