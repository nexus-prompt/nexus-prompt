#!/bin/bash

echo "Nexus Prompt セットアップを開始します..."

# npm installを実行
echo "依存関係をインストールしています..."
npm install

# ビルドを実行
echo "プロジェクトをビルドしています..."
npm run build

echo ""
echo "セットアップが完了しました！"
echo ""
echo "Chrome拡張機能をインストールする方法："
echo "1. Chromeで chrome://extensions/ を開く"
echo "2. 右上の「デベロッパーモード」を有効にする"
echo "3. 「パッケージ化されていない拡張機能を読み込む」をクリック"
echo "4. このプロジェクトの dist ディレクトリを選択"
echo ""
echo "開発モードで実行する場合："
echo "npm run dev" 
