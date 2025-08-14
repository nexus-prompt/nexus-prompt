interface AutosizeParams {
  maxRows?: number;
  minRows?: number;
  fixedRows?: number; // 指定時は rows を固定し、autosize 無効
}

/**
 * テキストエリアの高さを入力内容に応じて自動調整するSvelteアクション。
 * @param node - 対象のHTMLTextAreaElement
 * @param params - オプション: { maxRows?: number, minRows?: number }
 */
export function autosize(node: HTMLTextAreaElement, params: AutosizeParams = {}) {
  let maxRows = params.maxRows;
  let minRows = params.minRows;
  let fixedRows = params.fixedRows;

  // 初期 rows の有無を検出（属性 or 既定値からの差分）
  const attrRows = node.getAttribute('rows');
  const defaultRowsProbe = (() => {
    const el = document.createElement('textarea');
    return el.rows;
  })();
  const initiallyHasRows = attrRows !== null || node.rows !== defaultRowsProbe;

  // fixedRows が指定されていれば常に無効
  let enabled = !(typeof fixedRows === 'number' && fixedRows > 0) && !initiallyHasRows;
  let attached = false;
  let restorePatchedValue: (() => void) | undefined;
  let restorePatchedSetRangeText: (() => void) | undefined;

  function updateSize() {
    if (!enabled) return;

    const style = window.getComputedStyle(node);
    const isBorderBox = style.boxSizing === 'border-box';
    const borderTopWidth = parseFloat(style.borderTopWidth);
    const borderBottomWidth = parseFloat(style.borderBottomWidth);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingBottom = parseFloat(style.paddingBottom);
    const verticalBordersAndPadding = borderTopWidth + borderBottomWidth + paddingTop + paddingBottom;

    // line-height を取得。'normal'の場合はフォントサイズから概算
    let lineHeight = parseFloat(style.lineHeight);
    if (isNaN(lineHeight)) {
      lineHeight = parseFloat(style.fontSize) * 1.2;
    }

    // max/min height を計算して設定（rows の基準に合わせて算出）
    let computedMaxHeight: number | undefined;
    let computedMinHeight: number | undefined;

    if (typeof maxRows === 'number' && maxRows > 0) {
      // border-box の場合のみ、ボーダーとパディング分を加算
      computedMaxHeight = lineHeight * maxRows + (isBorderBox ? verticalBordersAndPadding : 0);
    }
    if (typeof minRows === 'number' && minRows > 0) {
      // border-box の場合のみ、ボーダーとパディング分を加算
      computedMinHeight = lineHeight * minRows + (isBorderBox ? verticalBordersAndPadding : 0);
    }
    if (computedMaxHeight !== undefined && computedMinHeight !== undefined && computedMaxHeight < computedMinHeight) {
      computedMaxHeight = computedMinHeight;
    }

    if (computedMaxHeight !== undefined) {
      node.style.maxHeight = `${computedMaxHeight}px`;
    } else {
      node.style.maxHeight = '';
    }

    if (computedMinHeight !== undefined) {
      node.style.minHeight = `${computedMinHeight}px`;
    } else {
      node.style.minHeight = '';
    }

    // 入力内容に基づいて必要な行数を算出し、node.rows を更新
    // scrollHeight はパディングを含むため、パディングを差し引いて行数を求める
    const prevRows = node.rows;
    // 最小状態にして scrollHeight を安定させる
    node.rows = 1;
    const contentHeight = Math.max(0, node.scrollHeight - paddingTop - paddingBottom);
    let requiredLines = lineHeight > 0 ? Math.ceil(contentHeight / lineHeight) : 1;
    if (!isFinite(requiredLines) || requiredLines <= 0) requiredLines = 1;

    // rows の下限/上限でクランプ
    const min = typeof minRows === 'number' && minRows > 0 ? minRows : 1;
    const max = typeof maxRows === 'number' && maxRows > 0 ? maxRows : undefined;
    let nextRows = Math.max(min, requiredLines);
    if (typeof max === 'number') nextRows = Math.min(nextRows, max);

    // 変更がある場合のみ反映
    if (prevRows !== nextRows) {
      node.rows = nextRows;
    } else {
      // 元に戻す
      node.rows = prevRows;
    }
  }

  function attach() {
    if (attached) return;
    node.addEventListener('input', updateSize);
    node.addEventListener('change', updateSize);
    attached = true;

    // value プロパティの setter をパッチして、JS からの値変更にも追従
    try {
      const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      if (desc && desc.set && desc.get) {
        Object.defineProperty(node, 'value', {
          configurable: true,
          enumerable: desc.enumerable ?? false,
          get() {
            return desc.get!.call(this);
          },
          set(v: string) {
            desc.set!.call(this, v);
            if (enabled) updateSize();
          },
        });
        restorePatchedValue = () => {
          delete (node as any).value;
        };
      }
    } catch {
      // noop: パッチに失敗しても致命的ではない
    }

    // setRangeText をフックして、プログラム変更にも追従
    if (typeof node.setRangeText === 'function') {
      const original = node.setRangeText;
      (node as any).setRangeText = (...args: any[]) => {
        const ret = (original as any).apply(node, args as any);
        if (enabled) updateSize();
        return ret;
      };
      restorePatchedSetRangeText = () => {
        (node as any).setRangeText = original;
      };
    }

    // 初期表示時: 値のバインドとレイアウト確定後のフレームで実行（ダブル rAF）
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(updateSize));
    } else {
      setTimeout(updateSize, 0);
    }
  }

  function detach() {
    if (!attached) return;
    node.removeEventListener('input', updateSize);
    node.removeEventListener('change', updateSize);
    if (restorePatchedValue) {
      restorePatchedValue();
      restorePatchedValue = undefined;
    }
    if (restorePatchedSetRangeText) {
      restorePatchedSetRangeText();
      restorePatchedSetRangeText = undefined;
    }
    attached = false;
  }

  function applyEnabledState() {
    if (enabled) {
      attach();
      updateSize();
    } else {
      detach();
      // fixedRows 指定時は rows を固定
      if (typeof fixedRows === 'number' && fixedRows > 0) {
        node.rows = Math.max(1, Math.floor(fixedRows));
      }
      // autosize の影響を解除
      node.style.height = '';
      node.style.maxHeight = '';
      node.style.minHeight = '';
    }
  }

  // 初期状態に応じてセットアップ（fixedRows があれば即適用）
  if (typeof fixedRows === 'number' && fixedRows > 0) {
    node.rows = Math.max(1, Math.floor(fixedRows));
  }
  applyEnabledState();

  return {
    update(newParams: AutosizeParams = {}) {
      maxRows = newParams.maxRows;
      minRows = newParams.minRows;
      fixedRows = newParams.fixedRows;
      // fixedRows の有無に応じて有効/無効を再評価
      enabled = !(typeof fixedRows === 'number' && fixedRows > 0) && !initiallyHasRows;
      if (typeof fixedRows === 'number' && fixedRows > 0) {
        node.rows = Math.max(1, Math.floor(fixedRows));
      }
      applyEnabledState();
    },
    destroy() {
      detach();
    },
  };
}
