<script lang="ts">
  import { autosize } from '../actions/autosize';
  import { viewContext } from '../stores';
  import type { LatestPromptDsl } from '../promptops/dsl/prompt/registry';
  let{ input, inputStringRows, value, onchange } = $props<{ input: LatestPromptDsl['inputs'][number], inputStringRows: number, value: string | undefined, onchange: (name: string, value: string) => void }>();

  function handleChange(e: Event) :void{
    const v = (e.target as HTMLTextAreaElement).value;
    onchange(input.name, v);
  }

  function handleClick() :void{
    const element = document.getElementById(input.name);
    if (element) {
      element.classList.remove('border-red-500');
    }
  }
</script>

<label for="{input.name}">差し込み（{input.type}）：&#123;&#123;{input.name ?? ''}&#125;&#125;</label> 

{#if input.type === 'number'} 
  <input type="number" id="{input.name}" bind:value="{value}" onchange={handleChange} onclick={handleClick} placeholder="{input.description ?? "差し込み数値の内容を入力してください。"}"/>
{:else if input.type === 'boolean'}
  <select id="{input.name}" bind:value="{value}" onchange={handleChange} onclick={handleClick}>
    <option value="">未選択{input.description ? `（${input.description}）` : ''}</option>
    <option value="はい" selected={String(input.default) === 'true'}>はい</option>
    <option value="いいえ" selected={String(input.default) === 'false'}>いいえ</option>
  </select>
{:else}
  <textarea 
    id="{input.name}" 
    bind:value="{value}" 
    onchange={handleChange}
    placeholder="{input.description ?? "差し込みテキストの内容を入力してください。"}"
    onclick={handleClick}
    use:autosize={{ maxRows: 5, minRows: 2, fixedRows: $viewContext === 'popup' ? inputStringRows : undefined }}
  ></textarea>
{/if}
