<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PromptInputView, PromptInputType } from '../../promptops/dsl/prompt/renderer';

  // Props
  let { inputTypes, initial, editing = false }: { inputTypes: { type: PromptInputType; typeLabel: string }[], initial?: Partial<PromptInputView>, editing?: boolean } = $props();

  const dispatch = createEventDispatcher<{ save: PromptInputView; cancel: void; delete: void }>();

  // Local state (draft)
  let type = $state<PromptInputType>((initial?.type as PromptInputType) ?? 'string');
  let name = $state(initial?.name ?? 'target_text');
  let required = $state<boolean>(Boolean(initial?.required));
  let description = $state<string>(initial?.description ?? '');
  let ref = $state<string>(initial?.ref ?? '');
  let defaultRaw = $state<string>(
    initial?.defaultValue != null ? JSON.stringify(initial.defaultValue) : ''
  );

  function parseDefaultByType(tp: PromptInputType, raw: string): unknown {
    if (raw === '' || raw == null) return undefined;
    try {
      switch (tp) {
        case 'number':
          return Number(raw);
        case 'boolean':
          return raw === 'true' ? true : raw === 'false' ? false : raw;
        case 'array':
        case 'object':
          return JSON.parse(raw);
        default:
          return raw;
      }
    } catch {
      return raw;
    }
  }

  function onSave() {
    const n = name.trim();
    if (!n) return;
    const data: PromptInputView = {
      name: n,
      type,
      required: !!required,
      ...(description ? { description } : {}),
      ...(ref ? { ref } : {}),
    } as PromptInputView;
    const parsed = parseDefaultByType(type, defaultRaw);
    if (parsed !== undefined) (data as any).defaultValue = parsed;
    dispatch('save', data);
  }

  function onCancel() {
    dispatch('cancel');
  }

  function onDelete() {
    dispatch('delete');
  }
</script>

<div class="modal-overlay" role="dialog" aria-modal="true">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">差し込みを追加</div>
      {#if editing}
        <button class="delete-button" type="button" onclick={onDelete}>削除</button>
      {/if}
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label class="field-label" for="input-type">タイプ</label>
        <select bind:value={type} id="input-type">
          {#each inputTypes as it}
            <option value={it.type}>{it.typeLabel}</option>
          {/each}
        </select>
      </div>
      <div class="form-row">
        <label class="field-label" for="input-name">名前</label>
        <input type="text" bind:value={name} placeholder="入力名 (例: user_name)" id="input-name" />
      </div>
      <div class="form-row inline">
        <label class="field-label" for="input-required">必須</label>
        <input type="checkbox" bind:checked={required} id="input-required" />
      </div>
      <div class="form-row">
        <label class="field-label" for="input-description">説明</label>
        <input type="text" bind:value={description} placeholder="任意の説明" id="input-description" />
      </div>
      <div class="form-row">
        <label class="field-label" for="input-default">デフォルト値</label>
        <input type="text" bind:value={defaultRaw} placeholder="型に応じた値" id="input-default" />
        <div class="hint">boolean は true/false</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="secondary-button" type="button" onclick={onCancel}>キャンセル</button>
      <button class="primary-button" type="button" onclick={onSave}>保存</button>
    </div>
  </div>
</div>

<style>
  /* Modal styles */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal {
    background: #fff;
    width: min(560px, 92vw);
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    overflow: hidden;
  }
  .modal-header {
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .modal-title {
    font-weight: 600;
  }
  .modal-body {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .form-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-row.inline {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }
  .field-label {
    font-size: 12px;
    color: #555;
  }
  .modal-footer {
    padding: 12px 16px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    border-top: 1px solid #eee;
  }
</style>
