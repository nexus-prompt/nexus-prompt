import NexusPrompt from './components/nexus-prompt.svelte'
import { mount } from 'svelte'

const target = document.getElementById('app')
if (!target) {
  throw new Error('Could not find app container')
}

mount(NexusPrompt, { target })
