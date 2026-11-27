# BelugaMDViewer

Windows 向けの単体 Markdown ビューアー＆リッチ（WYSIWYG）エディタです。  
Word 感覚の直感的なリッチ編集と、GitHub Flavored Markdown（GFM）＋数式＋Mermaid 図表のきれいなプレビュー表示を瞬時に切り替えられます。

> **クレジット / 非公式派生について**  
> 本アプリの Markdown プレビュー描画およびリッチ編集コンポーネントは、[stablyai/orca](https://github.com/stablyai/orca)（MIT License）のオープンソース実装を元に分離・再構成した **非公式の独立プロジェクト** です。元のプロジェクトおよび開発元とは無関係です。ライセンス詳細は [LICENSE](./LICENSE)、[LICENSE.orca.txt](./LICENSE.orca.txt)、[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) を参照してください。

---

## 主な機能

- **リッチ編集（WYSIWYG / Tiptap）**
  - **元に戻す / やり直す（Undo / Redo）**：ツールバーボタンおよび `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` に対応。プレビュー表示と行き来しても編集履歴を保持します。
  - 見出し（H1–H3）、太字・斜体・取り消し線・インラインコード、箇条書き・番号リスト・チェックリスト
  - テーブル編集（行・列の追加／削除のホバー操作バー付き）
  - `/` スラッシュコマンドメニューでブロックを素早く挿入
  - 折りたたみ `<details>` セクション、リンク編集バブル、ローカル画像挿入
  - コードブロック（言語切替・コピーボタン・Mermaid のリアルタイム図表プレビュー）
  - KaTeX 数式（インライン `$...$`・ブロック `$$...$$`）、YAML Frontmatter の保存時保持
- **レンダリングプレビュー**
  - GitHub Flavored Markdown（テーブル・チェックボックス・取り消し線・日本語/CJK対応）
  - GitHub Callouts（`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`）
  - Mermaid 図表（クリックで全画面拡大・パン＆ズーム表示）
  - KaTeX 数式、highlight.js シンタックスハイライト、相対パスのローカル画像表示・相対 `.md` リンク遷移
- **Windows デスクトップ機能**
  - 複数タブ、フォルダエクスプローラー（`Ctrl+B`）、リサイズ＆見出しレベル折りたたみ対応の目次パネル（`Ctrl+Shift+T`）
  - ドキュメント内検索（`Ctrl+F`）、ドラッグ＆ドロップで `.md` を開く、外部編集の自動検知・再読み込み
  - ライト / ダーク / システム連動テーマ、ズーム（`Ctrl+=` / `Ctrl+-` / `Ctrl+0`）
  - インストーラー版では `.md` / `.markdown` / `.mdx` のファイル関連付けに対応

---

## ショートカット一覧

| ショートカット | 動作 |
| --- | --- |
| `Ctrl+Z` | 元に戻す（Undo） |
| `Ctrl+Y` / `Ctrl+Shift+Z` | やり直す（Redo） |
| `Ctrl+N` | 新規ドキュメント |
| `Ctrl+O` | ファイルを開く |
| `Ctrl+Shift+O` | フォルダを開く |
| `Ctrl+S` / `Ctrl+Shift+S` | 保存 / 名前を付けて保存 |
| `Ctrl+W` | タブを閉じる |
| `Ctrl+Shift+V` | リッチ編集 / プレビュー切替 |
| `Ctrl+Shift+T` | 目次（Table of Contents）の表示切替 |
| `Ctrl+B` | フォルダエクスプローラーの表示切替 |
| `Ctrl+F` | ドキュメント内検索 |
| `Ctrl+K` | リンクの挿入・編集 |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | 拡大 / 縮小 / ズームリセット |

---

## Windows 配布版を使う際の注意（SmartScreen）

リリース版の `.exe` は個人ビルドのためコード署名証明書を付与していません。  
初回起動時に Windows Defender SmartScreen（「Windows によって PC が保護されました」）が表示された場合は、**「詳細情報」→「実行」** を選ぶか、下記の手順でソースコードからご自身でビルドしてください。

---

## 開発・ビルド手順

必要環境: Node.js 22+、pnpm 10+

```bash
pnpm install
pnpm run dev        # 開発起動
pnpm run typecheck  # 型チェック
pnpm run dist:win   # Windows Setup.exe / Portable.exe を dist/ にビルド
```

## License

MIT License — see [LICENSE](./LICENSE), [LICENSE.orca.txt](./LICENSE.orca.txt), and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
