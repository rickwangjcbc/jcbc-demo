# チーム共通のAI支援開発：利用開始ガイド

## 1. 共有するものと、まだ共有できていないもの

本ディレクトリはjcbc-demoのAI開発ルール・4つの工程手順・社内説明資料の正本です。個人のアプリ設定フォルダへ資料を配布する代わりに、同じGitコミットのファイルを参照します。
**GitHubで他メンバーが利用できるのは、これらの変更が承認され、commit・pushされ、共有するブランチへ取り込まれた後です。ファイル作成だけでは公開されません。**

Botの人格やアプリ登録情報ではなく、Botに記載していた共通ルールを`rules.md`として共有します。各端末のアプリ設定は変更しません。GitHubの閲覧権限、AIの利用許可、必要スキル・ツール・認証は各環境に必要です。秘密情報はGitに保存しません。

## 2. 読む順序

すべてのパスはリポジトリルート基準です。

| 順序・目的 | 資料 |
| --- | --- |
| 入口 | `AGENTS.md`、本書 |
| 共通ルール | `docs/ai-development/rules.md` |
| 対象・検証・承認条件 | `docs/ai-development/project-settings.md` |
| 要件担当と技術担当の分担 | `docs/ai-development/team-collaboration-guide.md` |
| 状態・停止・再開などの詳細 | `docs/ai-development/lifecycle-guide.md` |
| コピーして使う工程別プロンプト | `docs/ai-development/prompt-examples.md` |
| Issue作成（issue-creation） | `docs/ai-development/workflows/issue-creation.md` |
| 設計（issue-specification） | `docs/ai-development/workflows/issue-specification.md` |
| 開発・PR提出（issue-delivery） | `docs/ai-development/workflows/issue-delivery.md` |
| PR対応・マージ確認（pr-review-response） | `docs/ai-development/workflows/pr-review-response.md` |
| 提出前のAIレビュー（共通補助手順） | [double-check-loop](workflows/double-check-loop.md) |

## 3. 初回準備

1. 管理者が許可したリポジトリ・AIツール・モデルで利用する。開発担当が必要に応じて要件担当の準備を支援する。
2. GitHubの資料を読む場合は対象ブランチとコミットを確認する。AIにもURLから本文を実際に取得させる。非公開資料の取得不能を内容確認済みとしない。
3. 実作業では許可されたリポジトリを取得し、GitHub CLI・認証・各操作の権限と必要スキルを確認する。GitHubのWeb閲覧だけでローカル実装はできない。
4. `AGENTS.md`の自動読込を前提にせず、AIへ入口・共通ルール・案件別設定を明示指定する。参照コミット、依頼工程、対象Issue・PRを報告させる。
5. `project-settings.md`の未確定条件は人間が確定する。必要条件が不明なら該当工程を開始しない。

同じブランチ名でも各人の取得時点が異なります。作業開始時は`git rev-parse HEAD`等で参照版を確認し、GitHubから読む場合もコミット固定URLを使います。作業途中で自動pullや最新ルールへの切替はしません。更新はPRで確認し、進行中案件への適用を人間が判断します。

## 4. 依頼例

登録済みWorkflowの起動、設計承認、開発・PR指摘対応、MergeReady・Done確認、中断後の再開までの詳細テンプレートは`docs/ai-development/prompt-examples.md`にまとめています。以下はリポジトリの手順書を直接指定する短縮例です。

以下は自然文の依頼です。リポジトリ手順書はアプリ登録済みWorkflowではありません。登録を要求する環境では人間に登録を依頼し、同名の未登録Workflowを起動できたと偽りません。

案件別の実行条件は `project-settings.md`、工程ごとの確認は `lifecycle-guide.md` 第12節、日常手順は同ガイドの第19節を参照します。要件整理とIssue作成は `main` のworktreeで行い、Issue作成後は人間が用意したIssue専用の別worktreeで仕様書作成からPR提出まで進めます。

### 業務・要件担当：Issue作成

```text
AGENTS.md、docs/ai-development/README.md、rules.mdとproject-settings.mdを読んでください。
rules.mdとproject-settings.mdはdocs/ai-development/配下です。
docs/ai-development/workflows/issue-creation.mdを手順書として適用したいです。
対象はrickwangjcbc/jcbc-demo、要件は＜お客様と確認した内容＞です。
必要なスキル・操作許可を確認し、Issue作成前に内容への同意を待ってください。
```

さらに利用環境でユーザー自身が`/skill:interview-to-issue <要件>`を明示起動します。このスキルがない環境では導入・起動方法を人間に確認し、別の処理を同スキルとして代用しません。

### 設計・開発担当：設計

```text
AGENTS.mdとdocs/ai-development/のREADME.md、rules.md、project-settings.mdを読んでください。
Issue ＜URL＞について、docs/ai-development/workflows/issue-specification.mdを手順書として適用してください。
参照コミットは＜共有したコミット＞、作業場所は＜人間が用意したIssue専用worktreeの絶対パス＞です。
追加の業務判断は要件担当へ確認し、設計資料は保存後に承認を待ってください。
```

### 設計・開発担当：開発からPR提出

```text
AGENTS.mdとdocs/ai-development/のREADME.md、rules.md、project-settings.mdを読んでください。
Issue ＜URL＞について、docs/ai-development/workflows/issue-delivery.mdを手順書として適用してください。
参照コミットは＜コミット＞、人間が準備したworktreeは＜絶対パス＞、ブランチは＜名前＞です。
設計資料は＜リポジトリ相対パス・採用版＞、承認記録は＜参照先＞です。
既存AI担当は＜ID／未起動＞です。提出操作は必要な承認を確認してください。
```

レビュー対応は同じ入口と`docs/ai-development/workflows/pr-review-response.md`を指定し、Issue・PR・担当ID・worktree・設計承認・最新検証・必須CI／人間レビュー条件を渡します。人間マージ後は対象PRのマージ確認だけを明示依頼します。

## 5. 必要なスキルと環境依存

- **プロンプトの作成**：Issue URLや採用資料のSHAなどをJSONファイルに一度だけ記入し、`docs/ai-development/skills/render-workflow-prompt/SKILL.md` で、選んだ工程の変数を展開できます。ひな形と使い方は [プロンプト集の第1節](prompt-examples.md#1-この資料の使い方) を参照してください。展開に引き継ぎファイルは不要です。
- **引き継ぎ情報の照合**：`docs/ai-development/skills/load-workflow-context/SKILL.md` は、既存の引き継ぎ記録を読み取り、工程の入力を照合する別の手段です。使い方は [プロンプト集の第2節](prompt-examples.md#2-セッション開始時共通資料を読む) を参照してください。

スキルのファイルを同梱しても、アプリには自動登録されません。

以下の外部スキルは本体の同梱・自動インストールを行いません。実際のスキル定義を各環境で確認し、利用条件・版の相違を記録してください。利用不能なら必要な工程で停止し、人間へ報告します。

| 工程 | スキル・依存 |
| --- | --- |
| Issue作成 | `interview-to-issue`。手動起動、GitHub CLI・認証が必要 |
| 通常・高リスク設計 | `clarify-spec`、先行する`expert-mode-ja` |
| 提出前のAIレビュー | [共通補助手順](workflows/double-check-loop.md)。同じ担当の方式では実環境の `double-check` を使用。工程別引き継ぎでは読み取り専用レビュー。各回にユーザーの明示依頼が必要 |
| commit | `git-commit-ja` |
| 初回push・PR作成 | `git-push-and-create-merge-request-ja` |
| レビュー指摘 | `receiving-code-review`、AIレビュー・commitの各依存。既存PRへのpushは手順書内の専用工程 |
| 該当時 | `test-driven-development`、`systematic-debugging`、`verification-before-completion`等、環境の適用規則に従う |

開発委任の標準は前景実行と同じ担当の前景再開です。同一対話セッションでの継続は、R2と案件別設定に従い、実地検証と人間の事前採用承認が揃った環境・範囲に限ります。工程別引き継ぎは、開発依頼で対象Issue・採用ルールのコミット・方式を人間が明示し、通常の着手前確認を満たした場合に選べます。再開失敗時に自動で切り替えません。未対応のツールで並列書込や主エージェント実装へ無断で切り替えません。スキルの許可・禁止をリポジトリ文書で上書きしません。

## 6. 引き継ぎと正本の維持

- 人間同士はIssue URL・顧客確認済み内容・業務窓口を渡す。設計後は設計資料・採用版・承認・テスト方針を渡す。
- 別端末に渡す設計資料はGitHubで実際に取得できる状態を確認する。未コミットのローカル資料は別端末から参照できない。公開するcommit・pushは別途明示依頼・承認が必要で、設計Workflowから無断実行しない。
- 開発開始後はR2の記録を次の担当工程へ引き継ぐ。採用済みの方式で継続できなければ、停止して人間へ確認する。
- 個人環境の既存Bot・Workflowは今回変更しない。古い定義と異なる場合は上位規約と照合して人間に確認し、都合の良い方を選ばない。共有版更新後のローカルコピーの追従は自動ではない。
- リポジトリ内のルール変更も通常のPRで確認する。承認済みの設定と、未確認の提案・環境不足を区別する。

## 7. 現時点の制約

文書の読込は権限付与・機械的強制・アプリのBot登録ではありません。ラベル、CI、保護ルール、別セッションからの担当再開は、該当する工程で実環境の状態を確認します。必要な条件が不明なら該当操作を止めます。`Done`はマージ確認までで、本番配備の完了ではありません。
