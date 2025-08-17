<script lang="ts">
  import { autosize } from '../actions/autosize';
  import { viewContext } from '../stores';
  import type { LatestPromptDsl } from '../promptops/dsl/prompt/registry';
  const { input, inputStringRows } = $props<{ input: LatestPromptDsl['inputs'][number], inputStringRows: number }>();
  let value = $state(String(input.default ?? ''));
</script>

<label for="{input.name}">差し込み（{input.type}）：&#123;&#123;{input.name ?? ''}&#125;&#125;</label> 

{#if input.type === 'number'} 
  <input type="number" id="{input.name}" value="{value}" placeholder="{input.description ?? "差し込み数値の内容を入力してください。"}"/>
{:else if input.type === 'boolean'}
  <select id="{input.name}" value="{value}">
    <option value="">未選択{input.description ? `（${input.description}）` : ''}</option>
    <option value="true">はい</option>
    <option value="false">いいえ</option>
  </select>
{:else}
  <textarea 
    id="{input.name}" 
    value="{value}" 
    placeholder="{input.description ?? "差し込みテキストの内容を入力してください。"}"
    use:autosize={{ maxRows: 5, minRows: 2, fixedRows: $viewContext === 'popup' ? inputStringRows : undefined }}
  ></textarea>
{/if}
