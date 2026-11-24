# Issueからマージ確認まで：コピーして使えるプロンプト集

## 1. この資料の使い方

対象は`rickwangjcbc/jcbc-demo`です。業務・要件担当がIssueを作り、設計・開発担当がIssueを受け取って設計・開発・PR対応を進めます。最後のマージは権限を持つ人間が行います。要件整理・Issue作成は `main` のworktreeで行い、Issue作成後は人間が用意したIssue専用の別worktreeで仕様書作成からPR提出まで進めます。工程の書き込み前に、R8と案件別設定で試行または本格運用の許可範囲を確認します。

### 設計プロンプトを最小限の入力で作る

設計プロンプトのプレビューにはJSONファイルは不要です。対象Issue用に人間が用意したworktreeで、次のように依頼します。

```text
docs/ai-development/skills/render-workflow-prompt/SKILL.md を使い、
Issue #42 の設計プロンプトをプレビューしてください。
```

Issue URLと作業場所は案件別設定・Gitから補います。採用資料の版が未確認ならHEADを候補として提示するので、採用してよいか確認してください。確認したSHAを使い、未コミットの変更はその版に含めません。既存設計・業務窓口・設計承認者は、値がなければ「未確認」と明記します。設計を実際に依頼したときは、Issueや案件設定に当たり、必要な情報が見つからない場合だけ確認します。

端末から使う場合は対象Issueのworktreeで実行し、スクリプトのパスを置き換えます。`--docs-commit` には確認済みの完全なSHAを渡します。省略すると候補を表示して停止します。`origin` と対象Issueのブランチ名が一致しない場合も停止します。

```sh
python3 '/path/to/render.py' issue-specification --issue 42 --docs-commit '<確認済みのSHA>'
```

### 確定値を再利用する

必要に応じて[変数設定のひな形](skills/render-workflow-prompt/variables.example.json)をコピーし、確認済みの値だけをJSONに保存して再利用できます。ひな形の値は架空なので、そのまま工程の依頼には使わないでください。秘密情報や顧客の機密情報・個人情報は保存しません。開発・PR対応などの必須項目が未確認なら展開を止め、承認記録は推測で補いません。

| 節 | テンプレート名 |
| --- | --- |
| 2：共通資料確認 | `session-start` |
| 3：Issue作成・手動スキル起動 | `issue-creation`、`issue-interview` |
| 4：設計依頼・設計承認 | `issue-specification`、`design-approval` |
| 5：開発・PR提出 | `issue-delivery` |
| 6：PR指摘対応 | `pr-review-response` |
| 7・8：マージ準備・マージ後確認 | `merge-ready`、`post-merge` |
| 9：手順書による開発依頼 | `delivery-from-file` |
| 10：中断後の再開 | `resume` |

選んだテンプレートの必須値だけを確認し、不足があれば展開を止めます。展開結果を確認し、工程を実行したいときだけ別途送信してください。送信前に対象・資料の版を確認し、承認・マージなどの事実を文面だけで確定しないでください。

- 資料のあるブランチ・コミットを確認してください。共有資料のPRが未マージなら、`main`に資料があるとは限りません。
- 各工程を明示依頼し、設計承認・人間レビュー・マージを区切りに進めます。ラベル変更による自動起動やレビューの常時監視はありません。
- Workflow名で起動する場合は、実行環境にそのWorkflowが登録されていることと、採用したリポジトリ版との整合を確認します。
- 未登録の場合は第9節の「手順書を適用する依頼」を使います。ただし、環境が登録済みWorkflowのみを許可する場合は人間による登録が必要です。登録制約を迂回しません。
- 必要なスキル・CLI・認証・前景サブエージェント実行などの条件は、`docs/ai-development/README.md`と`docs/ai-development/project-settings.md`で確認します。

| 順序 | 主に依頼する人 | 依頼内容 | 正常終了時の状態 |
| --- | --- | --- | --- |
| 0 | その会話を開始するメンバー | 共通資料と環境の確認 | まだ作業開始しない |
| 1 | 業務・要件担当 | 顧客要望のIssue化 | `Spec` |
| 2 | 設計・開発担当 | 設計と人間の設計承認 | `Todo` |
| 3 | 設計・開発担当 | 開発・検証・PR作成 | `Review` |
| 4 | 設計・開発担当 | PR指摘の修正・再提出 | `Review` |
| 5 | 設計・開発担当 | マージ条件の確認 | 条件充足時のみ`MergeReady` |
| 6 | 権限を持つ人間 | GitHub上でマージ | AIはマージしない |
| 7 | 設計・開発担当 | マージ結果の再確認 | 確認できた場合のみ`Done` |

指摘がなければ修正工程は不要ですが、必須CI・必要な人間レビュー等の確認は省略しません。

## 2. セッション開始時：共通資料を読む

新しい会話や別メンバーへの引き継ぎ時に渡します。業務担当から技術担当へ移る際も、会話の記憶を共有できるとはみなしません。

<!-- prompt: session-start -->

```text
対象リポジトリは {{repository}} です。
作業場所：{{worktree_path}}
採用する共有資料のコミット：{{docs_commit}}

以下を全文読み、今回の作業に適用してください。
- AGENTS.md
- docs/ai-development/README.md
- docs/ai-development/rules.md
- docs/ai-development/project-settings.md

実際に読み込んだ資料の版と、必要なスキル・ツールの利用可否を報告してください。
共有資料に未コミット変更があれば、その内容と採用可否を確認してください。

登録済みWorkflowとリポジトリ内の手順書に不整合があれば、
勝手にどちらかを選ばず確認してください。
```

GitHubのURLから読む場合はコミット固定URLを指定し、本文の取得成功を確認させます。Webで資料が読めることと、ローカルで実装できることは別です。作業中に無断で最新ルールへ切り替えさせません。

### 引き継ぎファイルを使う短縮版

[引き継ぎファイルのひな形](skills/load-workflow-context/handoff-template.md)をIssueごとにコピーし、承認済みの記録先に置きます。Issue・PRのURL、採用資料のSHA、設計承認の参照先などは、そのファイルに一度だけ記入し、変更があったときに更新します。案件共通の条件は案件別設定から読み、作業場所・ブランチは必要な工程でGitから確認します。

まず、確認したい工程と引き継ぎファイルのパスだけを指定します。次は開発・PR提出の例です。

```text
docs/ai-development/skills/load-workflow-context/SKILL.md を使い、
引き継ぎファイル「＜パス＞」から開発・PR提出に必要な入力を確認してください。
不足や不一致がある項目だけ教えてください。
```

入力が揃ったら、同じ会話で対象を確認したうえで、工程を別途依頼します。登録済みWorkflowを使う場合は、正しい登録名と採用版を確認してください。次は環境がリポジトリ内の手順書の適用を許す場合の例です。

```text
直前に確認した引き継ぎの入力を使い、
docs/ai-development/workflows/issue-delivery.md を手順書として適用し、
開発からPR提出まで進めてください。必要な操作の承認は確認してください。
```

設計は `workflows/issue-specification.md`、PR指摘対応・マージ準備・マージ後確認は `workflows/pr-review-response.md` を使い、行う操作を明示します。別セッションでは同じ引き継ぎファイルを読み直します。ここでの確認は承認の代わりではなく、各工程の開始条件・手動起動条件も変わりません。

## 3. 業務・要件担当：Issueを作る

### 3.1 Workflowへ依頼する

<!-- prompt: issue-creation -->

```text
issue-creation を実行してください。

対象：{{repository}}
作業場所：{{worktree_path}}
採用資料：{{docs_commit}}

お客様の困りごと・実現したいこと：
{{requirements}}

顧客確認済みの内容：
{{confirmed_requirements}}

未確認の内容：
{{open_requirements}}

不明点は一問ずつ確認し、Issueの本文・ラベルを提示してください。
一覧全体への同意を得るまでIssueを作成しないでください。
interview-to-issueが未起動なら、私の明示起動を待ってください。
作成後はSpecの設定を確認し、Issue URLを報告して終了してください。
設計・開発はまだ開始しないでください。
```

### 3.2 ユーザー自身がスキルを起動する

`interview-to-issue`は手動起動専用です。AIからの案内に従い、ユーザーが入力します。

<!-- prompt: issue-interview -->

```text
/skill:interview-to-issue 上記の要望について要件を整理し、{{repository}} のIssueを作成したいです。
```

質問に回答し、最終的なIssue案全体に明示同意します。「今後は全部お任せ」では未確認の判断を一括承認できません。

**受け取るもの：** Issue URL、確認済み要件、未解決事項、再取得した`Spec`。技術担当へIssue URL・顧客確認済み内容・業務上の確認窓口を渡します。ラベルが不足した場合は作成・設定未完了の報告に従い、設計を開始しません。

## 4. 設計・開発担当：Issueから設計する

### 4.1 設計を依頼する

<!-- prompt: issue-specification -->

```text
issue-specification を実行してください。

対象Issue：{{issue_url}}
作業場所：{{worktree_path}}
採用資料：{{docs_commit}}
既存の設計資料：{{existing_design}}
業務上の確認窓口：{{business_contact}}
技術的な設計承認者：{{design_approver}}

未確認の項目は、工程開始前にIssueと案件設定を読み、特定できない必須項目だけ依頼者に確認してください。

Issue本文・全対象コメントと既存コードを確認し、
リスク区分と設計方針を提案してください。

業務判断が必要な点は推測せず、私へ確認してください。
必要に応じて要件担当からお客様へ確認します。

通常案件はclarify-specを利用して設計書を作成してください。
軽微案件は、人間が区分とIssue内簡易設計を承認した場合だけ別設計書を省略してください。
高リスク案件は追加ゲートと承認者を確認してください。
設計資料を提示し、人間の設計承認を得るまでTodoへ進めないでください。
コード実装・commit・pushはまだ行わないでください。
```

### 4.2 保存した資料を確認して承認する

<!-- prompt: design-approval -->

```text
{{approved_design}}を承認します。
承認者：{{design_approver}}
業務上の追加決定：{{business_decisions}}

この文面は技術承認者本人が内容を確認し、明示的に送信した場合のみ承認として扱ってください。

Issueへの必要な反映と設計資料との整合確認を行い、
必要なリスク別ゲートも満たした場合にTodoへ変更して再取得してください。
開発工程はまだ開始しないでください。
```

技術設計の承認は技術に詳しい承認者が行い、業務上の変更は要件担当が確認します。要件担当に理解できない技術設計の包括承認を求めません。

**受け取るもの：** 承認済み設計資料・採用版・承認記録・`Todo`。設計資料が別端末にある場合は、実際に参照可能な状態か確認します。設計Workflow自体はcommit・pushを行いません。

## 5. 設計・開発担当：開発からPR作成まで

設計で使用した同じIssue専用worktreeとブランチで依頼します。

<!-- prompt: issue-delivery -->

```text
issue-delivery を実行してください。

対象Issue：{{issue_url}}
採用資料：{{docs_commit}}
専用worktree：{{worktree_path}}
作業ブランチ：{{branch}}
マージ先：{{base_branch}}

承認済み設計資料：
{{approved_design}}

設計承認記録：
{{design_approval_record}}

設計書の既存差分・未公開状態と変更・提出可否：
{{design_submission_scope}}

既存の専任AI担当：
{{assigned_agent}}

開始条件を確認してからImpへ変更し、
専任サブエージェント1名へ前景実行で実装を依頼してください。

同じ担当で実装・必要な検証・double-check-loopを行い、
最終修正後の再確認で赤・黄の指摘ゼロを確認してください。
提出ゲート通過後、主エージェントがcommit・push・PR作成を行ってください。
必要なツール承認は省略しないでください。

PRと最新コミットを確認し、Reviewへ変更して結果を報告してください。
人間のマージは行わないでください。
```

**受け取るもの：** PR URL、提出コミット、検証結果、自己レビュー記録、担当IDと再開情報、`Review`。仕様矛盾・検証失敗・権限不足は現在工程で停止して報告させ、成功扱いしません。

## 6. レビュー指摘を修正・再提出する

人間のレビュー後に依頼します。AIにPRから指摘を取得させるため、指摘全文の貼り付けは必須ではありません。

<!-- prompt: pr-review-response -->

```text
pr-review-response を実行してください。

対象Issue：{{issue_url}}
対象PR：{{pr_url}}
採用資料：{{docs_commit}}
worktree：{{worktree_path}}
ブランチ：{{branch}}
既存の専任AI担当ID：{{assigned_agent}}
引き継ぎ記録：{{handoff_reference}}
設計資料：{{approved_design}}
設計承認記録：{{design_approval_record}}

PRの最新レビュー・コメント・未解決指摘を取得してください。
指摘を技術的に確認し、修正が必要なものはReworkへ変更して、
同じ担当に修正・関連検証・double-check-loopを依頼してください。

主エージェントが結果を照合した後、
commit・既存PRへの通常push・指摘別の対応報告を行い、
Reviewへ戻して報告してください。

範囲外・仕様変更・曖昧な指摘は、修正前に確認してください。
担当が再開できなければ停止し、自動交代しないでください。
force pushとマージは行わないでください。
```

既存PRへのpushはレビュー対応手順内の専用工程です。新規PR作成用スキルの終了をpush成功と扱いません。報告コメントの送信、スレッド解決、人間の承認は別の事実です。

## 7. マージ可能か確認する

CIと人間レビューが揃った段階で依頼します。未充足なら待っている条件を報告させます。

<!-- prompt: merge-ready -->

```text
pr-review-response でマージ準備を確認してください。

対象Issue：{{issue_url}}
対象PR：{{pr_url}}
採用資料：{{docs_commit}}
必須CI・必要な人間レビュー条件：{{merge_checks}}
既存担当・引き継ぎ記録：{{handoff_reference}}

最新head SHAに対する必須CI、必要な人間レビュー、
未解決指摘、競合、保護ルールを確認してください。

条件をすべて満たした場合だけMergeReadyへ変更し、
確認したSHAと証拠を報告してください。
条件が不明・未完了ならReviewを維持して残条件を報告してください。
マージはしないでください。
```

新規コミットなどで条件が変われば再評価します。必要な場合はworktree・ブランチ・設計資料などを既存の引き継ぎ記録から確認し、不足を尋ねます。AIの自己レビューだけで人間レビューを代替しません。

その後、**権限を持つ人間がGitHub上でマージ**します。

## 8. 人間のマージ後：Doneへ進める

<!-- prompt: post-merge -->

```text
対象PRは人間がマージしました。

pr-review-response でマージ後の確認を行ってください。

対象Issue：{{issue_url}}
対象PR：{{pr_url}}
採用資料：{{docs_commit}}

GitHubからmerged状態・マージ先・マージコミットと、
Issueとの対応を取得してください。
確認できた場合だけIssueをDoneへ変更し、再取得して報告してください。
```

この確認だけなら、修正用worktreeやAI担当の再開は不要です。未マージのクローズをDoneとせず、取得不能も確認済みと扱いません。Doneは本番配備や顧客検収の完了を意味しません。

## 9. Workflowが未登録の場合：手順書を適用する

アプリへの自動登録はありません。環境が許す場合は、Workflow名での起動の代わりに次の依頼を使います。上位の環境規約が登録を要求する場合は人間の登録を待ちます。

<!-- prompt: delivery-from-file -->

```text
共通資料を確認したうえで、Issue {{issue_url}}について、
docs/ai-development/workflows/issue-delivery.md を全文読み、
リポジトリ内の手順書として適用し、開発からPR作成まで進めてください。

採用資料のコミット：{{docs_commit}}
worktree：{{worktree_path}}
ブランチ：{{branch}}
設計資料：{{approved_design}}
設計承認記録：{{design_approval_record}}
既存AI担当：{{assigned_agent}}
設計書の変更・提出可否：{{design_submission_scope}}
必要な操作の承認は確認してください。
```

| 依頼したい工程 | 明示指定する手順書 |
| --- | --- |
| Issue作成 | `docs/ai-development/workflows/issue-creation.md` |
| 設計 | `docs/ai-development/workflows/issue-specification.md` |
| 開発・初回PR提出 | `docs/ai-development/workflows/issue-delivery.md` |
| 指摘修正・マージ準備・マージ後確認 | `docs/ai-development/workflows/pr-review-response.md` |

他の工程も同じように手順書のパスを指定し、各工程の入力を渡してください。手順書方式でも`interview-to-issue`のユーザー明示起動など、スキル固有の条件は変わりません。

## 10. 失敗・中断後に再開する

<!-- prompt: resume -->

```text
対象Issue：{{issue_url}}、対象PR：{{pr_url}}について、
{{resume_workflow}}の未完了工程を再開してください。

採用資料のコミット：{{docs_commit}}
worktree：{{worktree_path}}、ブランチ：{{branch}}、既存AI担当：{{assigned_agent}}
直前工程：{{stage_label}}
成功済み：{{completed_operations}}
失敗または結果不明：{{failed_operation}}
引き継ぎ記録・検証ログ・未対応指摘：{{handoff_reference}}
未完了と再開先：{{resume_point}}

最初に実状態を確認し、成功済み操作を繰り返さず、未完了だけ再開してください。
同じ担当が再開できない場合は停止し、人間の承認なしに交代しないでください。
```

担当交代が必要な場合は、共通ルールに従い、交代理由・対象・範囲への人間の明示承認、旧担当の停止確認、引き継ぎと再検証が必要です。保留・中止・重複の停止記録があれば、その解消と再開判断を先に確認します。

## 11. 詳細資料

- 入口・必要スキル：`docs/ai-development/README.md`
- 共通ルール：`docs/ai-development/rules.md`
- 検証・承認条件：`docs/ai-development/project-settings.md`
- 業務・技術の役割：`docs/ai-development/team-collaboration-guide.md`
- 状態・ゲート・停止・引き継ぎ：`docs/ai-development/lifecycle-guide.md`

本資料は依頼文のテンプレートです。掲載したプロンプトによる各工程の実行成功や、全メンバー環境での動作を保証するものではありません。
